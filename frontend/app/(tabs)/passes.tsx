import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/theme";
import { sendOtp, verifyOtp, Student } from "@/src/api";

type Step = "phone" | "otp" | "pass";

export default function PassesScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  const requestOtp = async () => {
    setError(null);
    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(phone);
      setHint(res.mock_otp_hint ?? "Enter the OTP sent to your mobile");
      setStep("otp");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message ?? "Failed to send OTP");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError("OTP must be 6 digits");
      return;
    }
    setLoading(true);
    try {
      const s = await verifyOtp(phone, otp);
      setStudent(s);
      setStep("pass");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message ?? "Invalid OTP");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("phone");
    setPhone("");
    setOtp("");
    setStudent(null);
    setError(null);
    setHint(null);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>My Pass</Text>
        <Text style={styles.headerSub}>Retrieve your Garba entry pass</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {step === "phone" && (
            <View style={styles.card} testID="phone-step">
              <View style={styles.iconHero}>
                <MaterialIcon name="cellphone-key" size={34} color={colors.brandTertiary} />
              </View>
              <Text style={styles.cardTitle}>Enter Mobile Number</Text>
              <Text style={styles.cardSub}>
                Use the mobile number you registered with. We'll send an OTP.
              </Text>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ""))}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
                testID="phone-input"
              />
              {error && <Text style={styles.errorText} testID="phone-error">{error}</Text>}
              <Pressable onPress={requestOtp} disabled={loading} style={styles.cta} testID="send-otp-btn">
                {loading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>Send OTP</Text>
                )}
              </Pressable>
            </View>
          )}

          {step === "otp" && (
            <View style={styles.card} testID="otp-step">
              <View style={styles.iconHero}>
                <MaterialIcon name="shield-key" size={34} color={colors.brandTertiary} />
              </View>
              <Text style={styles.cardTitle}>Enter OTP</Text>
              <Text style={styles.cardSub}>Sent to +91 {phone}</Text>
              {hint && (
                <View style={styles.hintBox} testID="otp-hint">
                  <MaterialIcon name="information" size={14} color={colors.brandTertiary} />
                  <Text style={styles.hintText}>{hint}</Text>
                </View>
              )}
              <TextInput
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ""))}
                placeholder="6-digit OTP"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, { letterSpacing: 8, textAlign: "center", fontSize: 20 }]}
                testID="otp-input"
              />
              {error && <Text style={styles.errorText} testID="otp-error">{error}</Text>}
              <Pressable onPress={confirmOtp} disabled={loading} style={styles.cta} testID="verify-otp-btn">
                {loading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>Verify & View Pass</Text>
                )}
              </Pressable>
              <Pressable onPress={reset} style={styles.textBtn}>
                <Text style={styles.textBtnText}>Change mobile number</Text>
              </Pressable>
            </View>
          )}

          {step === "pass" && student && (
            <PassCard student={student} onReset={reset} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PassCard({ student, onReset }: { student: Student; onReset: () => void }) {
  const approved = student.approved;
  return (
    <View style={styles.passCard} testID="pass-card">
      <View style={styles.passTop}>
        <View>
          <Text style={styles.passBrand}>TAAL TARANG</Text>
          <Text style={styles.passBrand2}>GARBA · 2026</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: approved ? colors.success : colors.warning }]}>
          <MaterialIcon
            name={approved ? "check-decagram" : "clock-outline"}
            size={14}
            color={approved ? colors.onSuccess : colors.onWarning}
          />
          <Text style={[styles.statusText, { color: approved ? colors.onSuccess : colors.onWarning }]}>
            {approved ? "Approved" : "Pending Approval"}
          </Text>
        </View>
      </View>

      <View style={styles.passBody}>
        <View style={styles.avatarWrap}>
          {student.photo_base64 ? (
            <Image source={{ uri: student.photo_base64 }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Text style={styles.avatarInitials}>
              {student.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.passName}>{student.full_name}</Text>
          <Text style={styles.passMeta}>Admission: {student.admission_no}</Text>
          <Text style={styles.passMeta}>Class: {student.student_class}</Text>
          <View style={styles.typeTag}>
            <MaterialIcon name="music" size={12} color={colors.onBrandTertiary} />
            <Text style={styles.typeTagText}>{student.type}</Text>
          </View>
        </View>
      </View>

      <View style={styles.passDivider} />

      <View style={styles.detailsRow}>
        <Detail label="Date" value="12 Oct 2026" />
        <Detail label="Time" value="5:30 PM" />
        <Detail label="Reg" value={student.date_of_registration} />
      </View>

      <View style={styles.venueBox}>
        <MaterialIcon name="map-marker" size={16} color={colors.brandSecondary} />
        <Text style={styles.venueText}>Katni Arts & Commerce College (Autonomous)</Text>
      </View>

      {!approved && (
        <View style={styles.pendingNote} testID="pending-note">
          <MaterialIcon name="information-outline" size={14} color={colors.warning} />
          <Text style={styles.pendingNoteText}>
            Your pass will be activated once admin approves your registration.
          </Text>
        </View>
      )}

      <Pressable onPress={onReset} style={styles.outlineBtn} testID="pass-reset-btn">
        <MaterialIcon name="refresh" size={16} color={colors.onSurface} />
        <Text style={styles.outlineBtnText}>Lookup Another</Text>
      </Pressable>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  headerTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  headerSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  iconHero: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center",
  },
  cardTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700", textAlign: "center" },
  cardSub: { color: colors.muted, fontSize: 13, textAlign: "center" },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    color: colors.onSurface,
    fontSize: 16,
    minHeight: 50,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.brandTertiary,
  },
  hintText: { color: colors.onSurface, fontSize: 12 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600" },
  cta: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "800" },
  textBtn: { alignItems: "center", paddingVertical: spacing.sm },
  textBtnText: { color: colors.brandTertiary, fontSize: 13, fontWeight: "600" },

  // Pass card
  passCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.md,
  },
  passTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  passBrand: { color: colors.brandTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  passBrand2: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  passBody: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  avatarWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 2, borderColor: colors.brandTertiary,
    overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitials: { color: colors.brandTertiary, fontSize: 24, fontWeight: "800" },
  passName: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  passMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  typeTagText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "700" },
  passDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 2 },
  detailsRow: { flexDirection: "row", gap: spacing.sm },
  detailLabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
  detailValue: { color: colors.onSurface, fontSize: 13, fontWeight: "700", marginTop: 2 },
  venueBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  venueText: { color: colors.onSurface, fontSize: 13, flex: 1 },
  pendingNote: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: "rgba(255,158,0,0.1)",
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  pendingNoteText: { color: colors.warning, fontSize: 12, flex: 1, fontWeight: "600" },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  outlineBtnText: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
});
