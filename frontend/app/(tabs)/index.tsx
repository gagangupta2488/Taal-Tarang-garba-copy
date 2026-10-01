import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { colors, spacing, radius } from "@/src/theme";

const HERO = require("../../assets/images/hero.jpg");

const CONTACTS = ["9893395454", "9753888872", "9244803105"];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const callNumber = (num: string) => {
    Haptics.selectionAsync();
    Linking.openURL(`tel:${num}`);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroWrap, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.badge} testID="hero-badge">
            <MaterialIcon name="star-four-points" size={14} color={colors.onBrandTertiary} />
            <Text style={styles.badgeText}>Cultural Festival 2026</Text>
          </View>
          <View style={styles.posterFrame}>
            <Image source={HERO} style={styles.hero} contentFit="cover" testID="hero-image" />
          </View>
          <Text style={styles.title} testID="app-title">Taal Tarang Garba</Text>
          <Text style={styles.subtitle}>
            Katni Arts & Commerce College (Autonomous) presents a night of rhythm, color & tradition.
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.card} testID="event-date-card">
            <View style={styles.cardIcon}>
              <MaterialIcon name="calendar-star" size={22} color={colors.brandTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Event Date</Text>
              <Text style={styles.cardValue}>12 October 2026</Text>
              <Text style={styles.cardSub}>Monday • 5:30 PM onwards</Text>
            </View>
          </View>

          <View style={styles.card} testID="event-venue-card">
            <View style={styles.cardIcon}>
              <MaterialIcon name="map-marker-radius" size={22} color={colors.brandSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Venue</Text>
              <Text style={styles.cardValue}>Katni Arts & Commerce College</Text>
              <Text style={styles.cardSub}>Katni (Autonomous)</Text>
            </View>
          </View>

          <View style={styles.contactCard} testID="event-contact-card">
            <View style={styles.contactHeader}>
              <MaterialIcon name="phone-in-talk" size={22} color={colors.brandPrimary} />
              <Text style={styles.contactTitle}>Contact Numbers</Text>
            </View>
            {CONTACTS.map((num) => (
              <Pressable
                key={num}
                onPress={() => callNumber(num)}
                style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.7 }]}
                testID={`contact-${num}`}
              >
                <Text style={styles.contactNumber}>+91 {num}</Text>
                <MaterialIcon name="phone-forward" size={18} color={colors.brandTertiary} />
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.push("/(tabs)/register");
            }}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            testID="register-now-btn"
          >
            <LinearGradient
              colors={[colors.brandPrimary, colors.brandSecondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Register Now</Text>
              <MaterialIcon name="arrow-right-circle" size={22} color={colors.onBrandPrimary} />
            </LinearGradient>
          </Pressable>

          <View style={styles.infoRow}>
            <View style={styles.infoChip}>
              <MaterialIcon name="music-note-eighth" size={14} color={colors.brandTertiary} />
              <Text style={styles.infoChipText}>Live DJ</Text>
            </View>
            <View style={styles.infoChip}>
              <MaterialIcon name="trophy-award" size={14} color={colors.brandTertiary} />
              <Text style={styles.infoChipText}>Prizes</Text>
            </View>
            <View style={styles.infoChip}>
              <MaterialIcon name="food-fork-drink" size={14} color={colors.brandTertiary} />
              <Text style={styles.infoChipText}>Food Stalls</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  heroWrap: { paddingHorizontal: spacing.lg, gap: spacing.md },
  posterFrame: {
    width: "100%",
    aspectRatio: 1024 / 923,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceSecondary,
  },
  hero: { width: "100%", height: "100%" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 12, letterSpacing: 0.4 },
  title: {
    fontSize: 30,
    color: colors.onSurface,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  content: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: { color: colors.muted, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
  cardValue: { color: colors.onSurface, fontSize: 16, fontWeight: "700", marginTop: 2 },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  contactCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  contactTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  contactNumber: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  cta: { borderRadius: radius.lg, overflow: "hidden", marginTop: spacing.sm },
  ctaGradient: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
  infoRow: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginTop: spacing.sm },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  infoChipText: { color: colors.onSurface, fontSize: 12, fontWeight: "600" },
});
