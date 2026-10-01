import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/theme";
import type { Student } from "@/src/api";

type Props = {
  student: Student | null;
  onClose: () => void;
  onDelete: (s: Student) => void;
};

export default function StudentDetailSheet({ student, onClose, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  if (!student) return null;
  const s = student;
  const initials = s.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const open = (url: string) => {
    Haptics.selectionAsync();
    Linking.openURL(url);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="student-sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="student-detail-sheet">
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Student Details</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8} testID="student-sheet-close">
            <MaterialIcon name="close" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          <View style={styles.hero}>
            <View style={styles.photoWrap}>
              {s.photo_base64 ? (
                <Image source={{ uri: s.photo_base64 }} style={styles.photo} contentFit="cover" testID="student-sheet-photo" />
              ) : (
                <Text style={styles.initials}>{initials}</Text>
              )}
            </View>
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
          </View>

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

          <Pressable
            onPress={() => onDelete(s)}
            style={styles.deleteBtn}
            testID="student-sheet-delete"
          >
            <MaterialIcon name="trash-can-outline" size={16} color={colors.onError} />
            <Text style={styles.deleteText}>Delete Registration</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
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
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.error,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  deleteText: { color: colors.onError, fontSize: 14, fontWeight: "800" },
});
