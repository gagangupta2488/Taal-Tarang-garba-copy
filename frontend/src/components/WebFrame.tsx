import type { PropsWithChildren } from "react";
import { Platform, StyleSheet, View, useWindowDimensions, Text } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing } from "@/src/theme";

export const FRAME_MAX_WIDTH = 480;
const WIDE_BREAKPOINT = 720;
const SIDE_INFO_BREAKPOINT = 1024;

const HERO = require("../../assets/images/hero.jpg");

/**
 * On web at desktop widths, renders the app inside a centered phone-width frame
 * so the mobile layout (bottom tabs etc.) looks intentional in a browser.
 * On native (or narrow web windows) it is a transparent pass-through.
 */
export default function WebFrame({ children }: PropsWithChildren) {
  const { width, height } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= WIDE_BREAKPOINT;

  if (!wide) return <>{children}</>;

  const frameHeight = Math.min(height - spacing.xxl * 2, 920);
  const showSideInfo = width >= SIDE_INFO_BREAKPOINT;

  return (
    <View style={styles.backdrop} testID="web-frame-backdrop">
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
      <LinearGradient
        colors={["rgba(5,9,26,0.82)", "rgba(5,9,26,0.92)"]}
        style={StyleSheet.absoluteFill}
      />
      {showSideInfo && (
        <View style={styles.sideInfo} testID="web-frame-side-info">
          <Text style={styles.sideKicker}>KATNI ARTS & COMMERCE COLLEGE</Text>
          <Text style={styles.sideTitle}>Taal Tarang Garba</Text>
          <Text style={styles.sideMeta}>12 October 2026 · 5:30 PM</Text>
          <Text style={styles.sideHint}>Open this site on your phone for the best experience, or install it as an app.</Text>
        </View>
      )}
      <View style={[styles.frame, { height: frameHeight }]} testID="web-frame">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sideInfo: {
    position: "absolute",
    width: 300,
    gap: spacing.sm,
    // sit to the left of the centered frame
    right: "50%",
    marginRight: FRAME_MAX_WIDTH / 2 + spacing.xxl,
  },
  sideKicker: { color: colors.brandTertiary, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  sideTitle: { color: colors.onSurface, fontSize: 40, fontWeight: "900", letterSpacing: -1, lineHeight: 44 },
  sideMeta: { color: colors.brandSecondary, fontSize: 16, fontWeight: "700" },
  sideHint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  frame: {
    width: FRAME_MAX_WIDTH,
    maxWidth: "100%",
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
