import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useIsFocused } from "expo-router";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import Head from "expo-router/head";
import { colors, spacing, radius } from "@/src/theme";
import { getStudent, Student } from "@/src/api";
import { loadMyPass, saveMyPass, clearMyPass } from "@/src/passStorage";

export default function PassesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandTertiary} />
        }
      >
        {loading && <ActivityIndicator color={colors.brandTertiary} style={{ marginTop: spacing.xl }} />}

        {!loading && !student && (
          <View style={styles.card} testID="no-pass">
            <View style={styles.iconHero}>
              <MaterialIcon name="ticket-confirmation-outline" size={34} color={colors.brandTertiary} />
            </View>
            <Text style={styles.cardTitle}>No Pass Yet</Text>
            <Text style={styles.cardSub}>
              {notice ?? "Register with your college admission number and your pass will appear here automatically."}
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/register")}
              style={styles.cta}
              testID="go-register-btn"
            >
              <Text style={styles.ctaText}>Register Now</Text>
            </Pressable>
          </View>
        )}

        {!loading && student && <PassCard student={student} />}
      </ScrollView>
    </View>
  );
}

function PassCard({ student }: { student: Student }) {
  return (
    <View style={styles.passCard} testID="pass-card">
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
  footerNote: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    paddingHorizontal: 2,
  },
  footerNoteText: { color: colors.muted, fontSize: 12, flex: 1 },
});
