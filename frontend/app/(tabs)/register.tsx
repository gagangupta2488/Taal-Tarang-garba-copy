import { useState } from "react";
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
import { registerStudent } from "@/src/api";
import { saveMyPass } from "@/src/passStorage";

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

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback({ type: "error", msg: err });
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
      setTimeout(() => router.push("/(tabs)/passes"), 1200);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback({ type: "error", msg: e?.message ?? "Registration failed" });
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

          <Field
            label="Admission No"
            value={form.admission_no}
            onChangeText={(v) => update("admission_no", v)}
            placeholder="Admission No from college list"
            autoCapitalize="characters"
            testID="field-admission-no"
          />
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
        maxLength={props.maxLength}
        multiline={props.multiline}
        style={[styles.input, props.multiline && { height: 80, textAlignVertical: "top" }]}
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
