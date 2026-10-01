// Design tokens for Taal Tarang Garba (Festive Dark theme)
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0B132B",
  onSurface: "#FDF8F5",
  surfaceSecondary: "#1C2541",
  onSurfaceSecondary: "#FDF8F5",
  surfaceTertiary: "#293241",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFD000",
  onSurfaceInverse: "#0B132B",
  muted: "#9FA6B2",

  brand: "#F72585",
  onBrand: "#FFFFFF",
  brandPrimary: "#F72585",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF9E00",
  onBrandSecondary: "#0B132B",
  brandTertiary: "#FFD000",
  onBrandTertiary: "#0B132B",

  success: "#06D6A0",
  onSuccess: "#0B132B",
  warning: "#FF9E00",
  onWarning: "#0B132B",
  error: "#E63946",
  onError: "#FFFFFF",
  info: "#4CC9F0",
  onInfo: "#0B132B",

  border: "#293241",
  borderStrong: "#FFD000",
  divider: "#1C2541",
  overlay: "rgba(5, 9, 22, 0.7)",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.light ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system as ColorScheme] ? (system as ColorScheme) : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export const colors = dark;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
