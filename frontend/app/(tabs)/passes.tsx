import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl,
  TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useIsFocused } from "expo-router";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import Head from "expo-router/head";
import { colors, spacing, radius } from "@/src/theme";
import { getStudent, getStudentByPhone, Student } from "@/src/api";
import { loadMyPass, saveMyPass, clearMyPass } from "@/src/passStorage";

const POSTER = require("../../assets/images/hero.jpg");

export default function PassesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const lookupByPhone = async () => {
    setLookupError(null);
    if (!/^\d{10}$/.test(phone)) {
      setLookupError("Please enter a valid 10-digit mobile number");
      return;
    }
    setLookupLoading(true);
    try {
      const s = await getStudentByPhone(phone);
      await saveMyPass(s);
      setStudent(s);
      setNotice(null);
      setPhone("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setLookupError(e?.message ?? "No registration found for this mobile number");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLookupLoading(false);
    }
  };

  const forgetPass = async () => {
    await clearMyPass();
    setStudent(null);
    setNotice(null);
  };

  const load = useCallback(async () => {
    const local = await loadMyPass();
    if (!local) {
      setStudent(null);
      setLoading(false);
      return;
    }
    setStudent(local);
    setLoading(false);
    try {
      const fresh = await getStudent(local.id);
      setStudent(fresh);
      await saveMyPass(fresh);
      setNotice(null);
    } catch (e: any) {
      if (e?.message === "Registration not found") {
        await clearMyPass();
        setStudent(null);
        setNotice("Your registration was removed by the admin. Please register again.");
      }
    }
  }, []);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) load();
  }, [isFocused, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.root}>
      <Head><title>My Pass · Taal Tarang Garba</title></Head>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>My Pass</Text>
        <Text style={styles.headerSub}>Your Garba entry pass</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandTertiary} />
        }
      >
        {loading && <ActivityIndicator color={colors.brandTertiary} style={{ marginTop: spacing.xl }} />}

        {!loading && !student && (
          <>
            <View style={styles.card} testID="phone-lookup">
              <View style={styles.iconHero}>
                <MaterialIcon name="cellphone-check" size={34} color={colors.brandTertiary} />
              </View>
              <Text style={styles.cardTitle}>Already Registered?</Text>
              <Text style={styles.cardSub}>
                Enter the mobile number you registered with to view your pass.
              </Text>
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, ""))}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={lookupByPhone}
                style={styles.input}
                testID="phone-input"
              />
              {lookupError && (
                <View style={styles.errorRow} testID="phone-error">
                  <MaterialIcon name="alert-circle" size={14} color={colors.error} />
                  <Text style={styles.errorText}>{lookupError}</Text>
                </View>
              )}
              <Pressable onPress={lookupByPhone} disabled={lookupLoading} style={styles.cta} testID="find-pass-btn">
                {lookupLoading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={styles.ctaText}>Find My Pass</Text>
                )}
              </Pressable>
            </View>

            <View style={styles.card} testID="no-pass">
              <View style={styles.iconHero}>
                <MaterialIcon name="ticket-confirmation-outline" size={34} color={colors.brandTertiary} />
              </View>
              <Text style={styles.cardTitle}>{notice ? "Pass Removed" : "New Here?"}</Text>
              <Text style={styles.cardSub}>
                {notice ?? "Register with your college admission number and your pass will appear here automatically."}
              </Text>
              <Pressable
                onPress={() => router.push("/(tabs)/register")}
                style={styles.outlineCta}
                testID="go-register-btn"
              >
                <Text style={styles.outlineCtaText}>Register Now</Text>
              </Pressable>
            </View>
          </>
        )}

        {!loading && student && (
          <>
            <PassCard student={student} />
            <Pressable onPress={forgetPass} style={styles.textBtn} testID="forget-pass-btn">
              <MaterialIcon name="account-switch-outline" size={16} color={colors.muted} />
              <Text style={styles.textBtnText}>Not you? Look up another pass</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PassCard({ student }: { student: Student }) {
  return (
    <View style={styles.passCard} testID="pass-card">
      <View style={styles.posterWrap}>
        <Image source={POSTER} style={styles.poster} contentFit="cover" testID="pass-poster" />
        <LinearGradient
          colors={["rgba(28,37,65,0)", "rgba(28,37,65,0)", "rgba(28,37,65,0.6)", colors.surfaceSecondary]}
          style={styles.posterScrim}
        />
        <View style={styles.posterBadge}>
          <MaterialIcon name="ticket-confirmation" size={14} color={colors.onBrandTertiary} />
          <Text style={styles.posterBadgeText}>ENTRY PASS</Text>
        </View>
      </View>
      <View style={styles.passTop}>
        <View>
          <Text style={styles.passBrand}>TAAL TARANG</Text>
          <Text style={styles.passBrand2}>GARBA · 2026</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
          <MaterialIcon name="check-decagram" size={14} color={colors.onSuccess} />
          <Text style={[styles.statusText, { color: colors.onSuccess }]}>Confirmed</Text>
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
          <Text style={styles.passMeta}>Father: {student.father_name}</Text>
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

      <View style={styles.footerNote}>
        <MaterialIcon name="information-outline" size={14} color={colors.muted} />
        <Text style={styles.footerNoteText}>Show this pass at the entry gate along with your college ID.</Text>
      </View>
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
  cardSub: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  cta: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "800" },
  outlineCta: {
    borderWidth: 1,
    borderColor: colors.brandTertiary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  outlineCtaText: { color: colors.brandTertiary, fontSize: 15, fontWeight: "800" },
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
    textAlign: "center",
    letterSpacing: 1,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: colors.error, fontSize: 13, fontWeight: "600", flex: 1 },
  textBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: spacing.md },
  textBtnText: { color: colors.muted, fontSize: 13, fontWeight: "600" },

  // Pass card
  passCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.md,
    overflow: "hidden",
  },
  posterWrap: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    width: "auto",
    aspectRatio: 1024 / 923,
    backgroundColor: colors.surfaceTertiary,
  },
  poster: { width: "100%", height: "100%" },
  posterScrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  posterBadge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  posterBadgeText: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
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
  footerNote: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    paddingHorizontal: 2,
  },
  footerNoteText: { color: colors.muted, fontSize: 12, flex: 1 },
});
