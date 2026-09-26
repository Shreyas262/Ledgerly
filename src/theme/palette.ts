import type { PaletteMode, PaletteOptions } from "@mui/material/styles";

// Slate scale used for neutrals (MUI `grey`), borders and muted surfaces.
const slate = {
  50: "#F8FAFC",
  100: "#F1F5F9",
  200: "#E2E8F0",
  300: "#CBD5E1",
  400: "#94A3B8",
  500: "#64748B",
  600: "#475569",
  700: "#334155",
  800: "#1E293B",
  900: "#0F172A",
  A100: "#F1F5F9",
  A200: "#E2E8F0",
  A400: "#94A3B8",
  A700: "#334155",
};

const lightPalette: PaletteOptions = {
  mode: "light",
  primary: {
    main: "#0F172A",
    light: "#1E293B",
    dark: "#020617",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#10B981",
    light: "#34D399",
    dark: "#059669",
    contrastText: "#FFFFFF",
  },
  success: {
    main: "#10B981",
    light: "#34D399",
    dark: "#059669",
    contrastText: "#FFFFFF",
  },
  warning: {
    main: "#F59E0B",
    light: "#FBBF24",
    dark: "#D97706",
    contrastText: "#0F172A",
  },
  error: {
    main: "#EF4444",
    light: "#F87171",
    dark: "#DC2626",
    contrastText: "#FFFFFF",
  },
  info: {
    main: "#3B82F6",
    light: "#60A5FA",
    dark: "#2563EB",
    contrastText: "#FFFFFF",
  },
  grey: slate,
  background: {
    default: "#F8FAFC",
    paper: "#FFFFFF",
  },
  text: {
    primary: "#0F172A",
    secondary: "#64748B",
    disabled: "#94A3B8",
  },
  divider: "#E2E8F0",
  action: {
    hover: "rgba(15, 23, 42, 0.04)",
    selected: "rgba(15, 23, 42, 0.08)",
  },
  sidebar: {
    background: "#0F172A",
    gradient: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)",
    topbarGradient: "linear-gradient(90deg, #1E293B 0%, #334155 100%)",
    text: "#E2E8F0",
    textMuted: "#94A3B8",
    hover: "rgba(148, 163, 184, 0.12)",
    activeBackground: "rgba(255, 255, 255, 0.08)",
    activeText: "#FFFFFF",
    activeIcon: "#34D399",
    border: "rgba(148, 163, 184, 0.16)",
  },
  status: {
    approved: { bg: "#ECFDF5", fg: "#047857" },
    pending: { bg: "#FFFBEB", fg: "#B45309" },
    rejected: { bg: "#FEF2F2", fg: "#B91C1C" },
    draft: { bg: "#F1F5F9", fg: "#475569" },
    info: { bg: "#EFF6FF", fg: "#1D4ED8" },
  },
  chart: {
    series: "#1E293B",
    track: "#F1F5F9",
  },
};

const darkPalette: PaletteOptions = {
  mode: "dark",
  primary: {
    main: "#E2E8F0",
    light: "#F8FAFC",
    dark: "#CBD5E1",
    contrastText: "#0F172A",
  },
  secondary: {
    main: "#34D399",
    light: "#6EE7B7",
    dark: "#10B981",
    contrastText: "#0B1120",
  },
  success: {
    main: "#34D399",
    light: "#6EE7B7",
    dark: "#10B981",
    contrastText: "#0B1120",
  },
  warning: {
    main: "#FBBF24",
    light: "#FCD34D",
    dark: "#F59E0B",
    contrastText: "#0B1120",
  },
  error: {
    main: "#F87171",
    light: "#FCA5A5",
    dark: "#EF4444",
    contrastText: "#0B1120",
  },
  info: {
    main: "#60A5FA",
    light: "#93C5FD",
    dark: "#3B82F6",
    contrastText: "#0B1120",
  },
  grey: slate,
  background: {
    default: "#0B1120",
    paper: "#111827",
  },
  text: {
    primary: "#F8FAFC",
    secondary: "#94A3B8",
    disabled: "#64748B",
  },
  divider: "#334155",
  action: {
    hover: "rgba(148, 163, 184, 0.08)",
    selected: "rgba(148, 163, 184, 0.16)",
  },
  sidebar: {
    background: "#111827",
    gradient: "linear-gradient(180deg, #0B1120 0%, #1E293B 100%)",
    topbarGradient: "linear-gradient(90deg, #111827 0%, #1E293B 100%)",
    text: "#E2E8F0",
    textMuted: "#94A3B8",
    hover: "rgba(148, 163, 184, 0.12)",
    activeBackground: "rgba(255, 255, 255, 0.08)",
    activeText: "#F8FAFC",
    activeIcon: "#34D399",
    border: "rgba(148, 163, 184, 0.16)",
  },
  status: {
    approved: { bg: "rgba(52, 211, 153, 0.14)", fg: "#6EE7B7" },
    pending: { bg: "rgba(245, 158, 11, 0.16)", fg: "#FCD34D" },
    rejected: { bg: "rgba(239, 68, 68, 0.16)", fg: "#FCA5A5" },
    draft: { bg: "rgba(148, 163, 184, 0.16)", fg: "#CBD5E1" },
    info: { bg: "rgba(59, 130, 246, 0.16)", fg: "#93C5FD" },
  },
  chart: {
    series: "#94A3B8",
    track: "rgba(148, 163, 184, 0.12)",
  },
};

export const getPalette = (mode: PaletteMode): PaletteOptions =>
  mode === "light" ? lightPalette : darkPalette;
