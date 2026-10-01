import { useEffect, useState } from "react";
import {
  Modal, View, Text, StyleSheet, Pressable, ScrollView, Linking, Platform,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/theme";
import { adminUpdateStudent, type Student, type StudentType, type StudentUpdate } from "@/src/api";

type Props = {
  student: Student | null;
  onClose: () => void;
  onDelete: (s: Student) => void;
  onUpdated: (s: Student) => void;
};

type EditForm = Required<Omit<StudentUpdate, "type">> & { type: StudentType };

const toForm = (s: Student): EditForm => ({
  full_name: s.full_name,
  father_name: s.father_name,
  date_of_birth: s.date_of_birth,
  address: s.address,
  student_class: s.student_class,
  phone_no: s.phone_no,
  whatsapp_no: s.whatsapp_no,
  email: s.email,
  type: s.type as StudentType,
});

export default function StudentDetailSheet({ student, onClose, onDelete, onUpdated }: Props) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setError(null);
    setForm(student ? toForm(student) : null);
  }, [student?.id]);

  if (!student) return null;
  const s = student;
  const initials = s.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const open = (url: string) => {
    Haptics.selectionAsync();
    Linking.openURL(url);
  };

  const set = <K extends keyof EditForm>(k: K, v: EditForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const startEdit = () => {
    Haptics.selectionAsync();
    setForm(toForm(s));
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
    setForm(toForm(s));
  };

  const save = async () => {
    if (!form) return;
    setError(null);
    if (!form.full_name.trim()) return setError("Full name is required");
    if (!form.student_class.trim()) return setError("Class is required");
    if (!/^\d{10}$/.test(form.phone_no)) return setError("Phone must be 10 digits");
    if (!/^\d{10}$/.test(form.whatsapp_no)) return setError("WhatsApp must be 10 digits");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Valid email required");

    const changes: StudentUpdate = {};
    (Object.keys(form) as (keyof EditForm)[]).forEach((k) => {
      const next = typeof form[k] === "string" ? (form[k] as string).trim() : form[k];
      if (next !== (s as any)[k]) (changes as any)[k] = next;
    });
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await adminUpdateStudent(s.id, changes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdated(updated);
      setEditing(false);
      setSavedMsg("Changes saved");
      setTimeout(() => setSavedMsg(null), 2200);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="student-sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="student-detail-sheet">
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{editing ? "Edit Student" : "Student Details"}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {!editing && (
              <Pressable onPress={startEdit} style={[styles.closeBtn, { backgroundColor: colors.brandTertiary }]} hitSlop={8} testID="student-sheet-edit">
                <MaterialIcon name="pencil" size={18} color={colors.onBrandTertiary} />
              </Pressable>
            )}
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8} testID="student-sheet-close">
              <MaterialIcon name="close" size={20} color={colors.onSurface} />
            </Pressable>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.photoWrap}>
              {s.photo_base64 ? (
                <Image source={{ uri: s.photo_base64 }} style={styles.photo} contentFit="cover" testID="student-sheet-photo" />
              ) : (
                <Text style={styles.initials}>{initials}</Text>
              )}
            </View>
            {!editing && (
              <>
                <Text style={styles.name} testID="student-sheet-name">{s.full_name}</Text>
                <View style={styles.tagRow}>
                  <View style={styles.tag}>
                    <MaterialIcon name={s.type === "Workshop" ? "school" : "music"} size={12} color={colors.onBrandTertiary} />
                    <Text style={styles.tagText}>{s.type}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: colors.surfaceTertiary }]}>
                    <Text style={[styles.tagText, { color: colors.onSurface }]}>Adm {s.admission_no}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {editing && form ? (
            <View style={{ gap: spacing.md }} testID="student-edit-form">
              <Text style={styles.editHint}>Admission No {s.admission_no} cannot be changed.</Text>
              <EditField label="Full Name" value={form.full_name} onChangeText={(v) => set("full_name", v)} testID="edit-full-name" />
              <EditField label="Father's Name" value={form.father_name} onChangeText={(v) => set("father_name", v)} testID="edit-father-name" />
              <EditField label="Date of Birth" value={form.date_of_birth} onChangeText={(v) => set("date_of_birth", v)} placeholder="DD/MM/YYYY" testID="edit-dob" />
              <View>
                <Text style={styles.label}>Type</Text>
                <View style={styles.segment}>
                  {(["Free-Style", "Workshop"] as StudentType[]).map((t) => {
                    const active = form.type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => { Haptics.selectionAsync(); set("type", t); }}
                        style={[styles.segmentItem, active && styles.segmentItemActive]}
                        testID={`edit-type-${t.toLowerCase()}`}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <EditField label="Class" value={form.student_class} onChangeText={(v) => set("student_class", v)} testID="edit-class" />
              <EditField label="Phone" value={form.phone_no} onChangeText={(v) => set("phone_no", v.replace(/[^0-9]/g, ""))} keyboardType="phone-pad" maxLength={10} testID="edit-phone" />
              <EditField label="WhatsApp" value={form.whatsapp_no} onChangeText={(v) => set("whatsapp_no", v.replace(/[^0-9]/g, ""))} keyboardType="phone-pad" maxLength={10} testID="edit-whatsapp" />
              <EditField label="Email" value={form.email} onChangeText={(v) => set("email", v)} keyboardType="email-address" autoCapitalize="none" testID="edit-email" />
              <EditField label="Address" value={form.address} onChangeText={(v) => set("address", v)} multiline testID="edit-address" />

              {error && (
                <View style={styles.errorBox} testID="edit-error">
                  <MaterialIcon name="alert-circle" size={16} color={colors.onError} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable onPress={cancelEdit} disabled={saving} style={styles.cancelBtn} testID="edit-cancel">
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={save} disabled={saving} style={styles.saveBtn} testID="edit-save">
                  {saving ? (
                    <ActivityIndicator color={colors.onBrandPrimary} />
                  ) : (
                    <>
                      <MaterialIcon name="content-save" size={16} color={colors.onBrandPrimary} />
                      <Text style={styles.saveText}>Save Changes</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {savedMsg && (
                <View style={styles.savedBox} testID="edit-saved">
                  <MaterialIcon name="check-circle" size={16} color={colors.onSuccess} />
                  <Text style={styles.savedText}>{savedMsg}</Text>
                </View>
              )}
              <View style={styles.quickRow}>
                <QuickAction icon="phone" label="Call" onPress={() => open(`tel:${s.phone_no}`)} testID="student-sheet-call" />
                <QuickAction icon="whatsapp" label="WhatsApp" onPress={() => open(`https://wa.me/91${s.whatsapp_no}`)} testID="student-sheet-whatsapp" />
                <QuickAction icon="email-outline" label="Email" onPress={() => open(`mailto:${s.email}`)} testID="student-sheet-email" />
              </View>

              <View style={styles.card}>
                <Row icon="account" label="Father's Name" value={s.father_name} />
                <Row icon="cake-variant" label="Date of Birth" value={s.date_of_birth} />
                <Row icon="school-outline" label="Class" value={s.student_class} />
                <Row icon="phone" label="Phone" value={`+91 ${s.phone_no}`} />
                <Row icon="whatsapp" label="WhatsApp" value={`+91 ${s.whatsapp_no}`} />
                <Row icon="email-outline" label="Email" value={s.email} />
                <Row icon="map-marker-outline" label="Address" value={s.address} />
                <Row icon="calendar-check" label="Registered On" value={s.date_of_registration} last />
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Pressable onPress={startEdit} style={styles.editBtn} testID="student-sheet-edit-btn">
                  <MaterialIcon name="pencil-outline" size={16} color={colors.onBrandTertiary} />
                  <Text style={styles.editText}>Edit Details</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(s)} style={styles.deleteBtn} testID="student-sheet-delete">
                  <MaterialIcon name="trash-can-outline" size={16} color={colors.onError} />
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditField(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  multiline?: boolean;
  testID?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={props.keyboardType ?? "default"}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        autoCorrect={false}
        maxLength={props.maxLength}
        multiline={props.multiline}
        style={[styles.input, props.multiline && { height: 72, textAlignVertical: "top" }]}
        testID={props.testID}
      />
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} style={styles.quick} testID={testID}>
      <MaterialIcon name={icon} size={20} color={colors.brandTertiary} />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function Row({ icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <MaterialIcon name={icon} size={18} color={colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} selectable>{value || "—"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
  },
  handle: {
    alignSelf: "center",
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  hero: { alignItems: "center", gap: spacing.sm },
  photoWrap: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 3, borderColor: colors.brandTertiary,
    overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  photo: { width: "100%", height: "100%" },
  initials: { color: colors.brandTertiary, fontSize: 36, fontWeight: "800" },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800", textAlign: "center" },
  tagRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "700" },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quick: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 60,
  },
  quickText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", paddingVertical: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { color: colors.muted, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
  rowValue: { color: colors.onSurface, fontSize: 15, fontWeight: "600", marginTop: 2, lineHeight: 20 },
  deleteBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.error,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  deleteText: { color: colors.onError, fontSize: 14, fontWeight: "800" },
  editBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.brandTertiary,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  editText: { color: colors.onBrandTertiary, fontSize: 14, fontWeight: "800" },
  editHint: { color: colors.muted, fontSize: 12, textAlign: "center" },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    color: colors.onSurface,
    fontSize: 15,
    minHeight: 46,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.sm },
  segmentItemActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  segmentTextActive: { color: colors.onBrandPrimary },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: { color: colors.onError, fontSize: 13, fontWeight: "600", flex: 1 },
  savedBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    backgroundColor: colors.success,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  savedText: { color: colors.onSuccess, fontSize: 13, fontWeight: "700" },
  cancelBtn: {
    flex: 1,
    alignItems: "center", justifyContent: "center",
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  cancelText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  saveBtn: {
    flex: 2,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
  },
  saveText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "800" },
});
