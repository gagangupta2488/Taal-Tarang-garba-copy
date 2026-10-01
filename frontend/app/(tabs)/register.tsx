import { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import Head from "expo-router/head";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme";
import { registerStudent, checkAdmission } from "@/src/api";
import { saveMyPass } from "@/src/passStorage";

type AdmissionStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "error"; msg: string };

const ADMISSION_NOT_FOUND = "Admission number not found in college list. Please contact the admin.";
const ADMISSION_REGISTERED = "This admission number is already registered. Open My Pass to view your pass.";

type FormState = {
  admission_no: string;
  full_name: string;
  date_of_birth: string;
  father_name: string;
  type: "Free-Style" | "Workshop";
  address: string;
  student_class: string;
  phone_no: string;
  whatsapp_no: string;
  email: string;
};

const INITIAL: FormState = {
  admission_no: "",
  full_name: "",
  date_of_birth: "",
  father_name: "",
  type: "Free-Style",
  address: "",
  student_class: "",
  phone_no: "",
  whatsapp_no: "",
  email: "",
};

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [admissionStatus, setAdmissionStatus] = useState<AdmissionStatus>({ state: "idle" });
  const scrollRef = useRef<ScrollView>(null);

  // Live check of the admission number against the admin's list (debounced)
  useEffect(() => {
    const value = form.admission_no.trim();
    if (!value) {
      setAdmissionStatus({ state: "idle" });
      return;
    }
    let cancelled = false;
    setAdmissionStatus({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await checkAdmission(value);
        if (cancelled) return;
        if (!res.allowed) setAdmissionStatus({ state: "error", msg: ADMISSION_NOT_FOUND });
        else if (res.registered) setAdmissionStatus({ state: "error", msg: ADMISSION_REGISTERED });
        else setAdmissionStatus({ state: "ok" });
      } catch {
        if (!cancelled) setAdmissionStatus({ state: "idle" });
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [form.admission_no]);

  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
  });

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pickPhoto = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setFeedback({ type: "error", msg: "Permission to access photos is required." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    Haptics.selectionAsync();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setFeedback({ type: "error", msg: "Camera permission is required." });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const validate = (): string | null => {
    if (!form.admission_no.trim()) return "Admission No is required";
    if (admissionStatus.state === "error") return admissionStatus.msg;
    if (!form.full_name.trim()) return "Full Name is required";
    if (!form.date_of_birth.trim()) return "Date of Birth is required";
    if (!form.father_name.trim()) return "Father Name is required";
    if (!form.address.trim()) return "Address is required";
    if (!form.student_class.trim()) return "Class is required";
    if (!/^\d{10}$/.test(form.phone_no)) return "Phone must be 10 digits";
    if (!/^\d{10}$/.test(form.whatsapp_no)) return "WhatsApp must be 10 digits";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return "Valid email required";
    return null;
  };

  const isAdmissionError = (msg: string) => /admission number/i.test(msg);

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback({ type: "error", msg: err });
      if (isAdmissionError(err)) scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const student = await registerStudent({ ...form, photo_base64: photo });
      await saveMyPass(student);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback({
        type: "success",
        msg: "Registered successfully! Opening your pass…",
      });
      setForm(INITIAL);
      setPhoto(null);
      setAdmissionStatus({ state: "idle" });
      setTimeout(() => router.push("/(tabs)/passes"), 1200);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = e?.message ?? "Registration failed";
      setFeedback({ type: "error", msg });
      if (isAdmissionError(msg)) {
        setAdmissionStatus({ state: "error", msg });
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <Head><title>Register · Taal Tarang Garba</title></Head>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>Student Registration</Text>
        <Text style={styles.headerSub}>Fill in your details to join Taal Tarang Garba</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo */}
          <View style={styles.photoCard}>
            <Pressable
              onPress={pickPhoto}
              style={styles.photoBox}
              testID="student-photo-picker"
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photoImg} contentFit="cover" />
              ) : (
                <View style={{ alignItems: "center", gap: 6 }}>
                  <MaterialIcon name="camera-plus" size={32} color={colors.brandTertiary} />
                  <Text style={styles.photoHint}>Tap to upload photo</Text>
                </View>
              )}
            </Pressable>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable style={styles.photoBtn} onPress={pickPhoto} testID="pick-photo-btn">
                <MaterialIcon name="image" size={16} color={colors.onSurface} />
                <Text style={styles.photoBtnText}>Gallery</Text>
              </Pressable>
              <Pressable style={styles.photoBtn} onPress={takePhoto} testID="take-photo-btn">
                <MaterialIcon name="camera" size={16} color={colors.onSurface} />
                <Text style={styles.photoBtnText}>Camera</Text>
              </Pressable>
            </View>
          </View>

          <ReadOnlyField label="Date of Registration" value={today} />

          <View>
            <Field
              label="Admission No"
              value={form.admission_no}
              onChangeText={(v) => update("admission_no", v)}
              placeholder="Admission No from college list"
              autoCapitalize="characters"
              testID="field-admission-no"
              status={admissionStatus.state === "error" ? "error" : admissionStatus.state === "ok" ? "ok" : undefined}
            />
            {admissionStatus.state === "checking" && (
              <View style={styles.fieldHint} testID="admission-checking">
                <ActivityIndicator size="small" color={colors.muted} />
                <Text style={styles.fieldHintText}>Checking admission number…</Text>
              </View>
            )}
            {admissionStatus.state === "ok" && (
              <View style={styles.fieldHint} testID="admission-ok">
                <MaterialIcon name="check-circle" size={14} color={colors.success} />
                <Text style={[styles.fieldHintText, { color: colors.success }]}>Admission number verified</Text>
              </View>
            )}
            {admissionStatus.state === "error" && (
              <View style={styles.fieldHint} testID="admission-error">
                <MaterialIcon name="alert-circle" size={14} color={colors.error} />
                <Text style={[styles.fieldHintText, { color: colors.error }]}>{admissionStatus.msg}</Text>
              </View>
            )}
          </View>
          <Field
            label="Full Name"
            value={form.full_name}
            onChangeText={(v) => update("full_name", v)}
            placeholder="Enter your full name"
            testID="field-full-name"
          />
          <Field
            label="Date of Birth"
            value={form.date_of_birth}
            onChangeText={(v) => update("date_of_birth", v)}
            placeholder="DD/MM/YYYY"
            testID="field-dob"
          />
          <Field
            label="Father's Name"
            value={form.father_name}
            onChangeText={(v) => update("father_name", v)}
            placeholder="Father's full name"
            testID="field-father-name"
          />

          {/* Type segmented */}
          <View>
            <Text style={styles.label}>Type</Text>
            <View style={styles.segment} testID="type-segment">
              {(["Free-Style", "Workshop"] as const).map((t) => {
                const active = form.type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      Haptics.selectionAsync();
                      update("type", t);
                    }}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                    testID={`type-${t.toLowerCase()}`}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field
            label="Address"
            value={form.address}
            onChangeText={(v) => update("address", v)}
            placeholder="Street, City"
            multiline
            testID="field-address"
          />
          <Field
            label="Class"
            value={form.student_class}
            onChangeText={(v) => update("student_class", v)}
            placeholder="e.g. BA-II / 12th / BCom"
            testID="field-class"
          />
          <Field
            label="Phone Number"
            value={form.phone_no}
            onChangeText={(v) => update("phone_no", v.replace(/[^0-9]/g, ""))}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            testID="field-phone"
          />
          <Field
            label="WhatsApp Number"
            value={form.whatsapp_no}
            onChangeText={(v) => update("whatsapp_no", v.replace(/[^0-9]/g, ""))}
            placeholder="10-digit WhatsApp number"
            keyboardType="phone-pad"
            maxLength={10}
            testID="field-whatsapp"
          />
          <Field
            label="Email Address"
            value={form.email}
            onChangeText={(v) => update("email", v)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            testID="field-email"
          />

          {feedback && (
            <View
              style={[
                styles.feedback,
                { backgroundColor: feedback.type === "success" ? colors.success : colors.error },
              ]}
              testID="form-feedback"
            >
              <MaterialIcon
                name={feedback.type === "success" ? "check-circle" : "alert-circle"}
                size={18}
                color={feedback.type === "success" ? colors.onSuccess : colors.onError}
              />
              <Text
                style={[
                  styles.feedbackText,
                  { color: feedback.type === "success" ? colors.onSuccess : colors.onError },
                ]}
              >
                {feedback.msg}
              </Text>
            </View>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={({ pressed }) => [styles.submit, pressed && { opacity: 0.9 }]}
            testID="submit-registration-btn"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Text style={styles.submitText}>Submit Registration</Text>
                <MaterialIcon name="arrow-right-circle" size={20} color={colors.onBrandPrimary} />
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  multiline?: boolean;
  testID?: string;
  status?: "ok" | "error";
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
        style={[
          styles.input,
          props.multiline && { height: 80, textAlignVertical: "top" },
          props.status === "error" && { borderColor: colors.error },
          props.status === "ok" && { borderColor: colors.success },
        ]}
        testID={props.testID}
      />
    </View>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.input, { justifyContent: "center" }]}>
        <Text style={{ color: colors.brandTertiary, fontWeight: "700" }}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  photoCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  photoBox: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.brandTertiary,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  photoImg: { width: "100%", height: "100%" },
  photoHint: { color: colors.muted, fontSize: 12 },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoBtnText: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  label: {
    color: colors.muted,
    fontSize: 12,
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
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    color: colors.onSurface,
    fontSize: 15,
    minHeight: 48,
  },
  fieldHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  fieldHintText: { color: colors.muted, fontSize: 12, fontWeight: "600", flex: 1 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  segmentItemActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.muted, fontWeight: "600" },
  segmentTextActive: { color: colors.onBrandPrimary },
  feedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  feedbackText: { fontSize: 13, flex: 1, fontWeight: "600" },
  submit: {
    marginTop: spacing.sm,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  submitText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },
});
