import type { PaletteMode, PaletteOptions } from "@mui/material/styles";

// Steps from Radix Colors (MIT), light and dark scales: 1-2 backgrounds, 3-5 component
// fills, 6-8 borders, 9-10 solid fills, 11-12 text. A few status inks are deepened past
// step 11 so small chip text clears 4.5:1; palette.test.ts guards every pair.

// Slate (light 2-12, dark 3-7) used for neutrals (MUI `grey`).
const slate = {
  50: "#F9F9FB",
  100: "#F0F0F3",
  200: "#E8E8EC",
  300: "#D9D9E0",
  400: "#B9BBC6",
  500: "#8B8D98",
  600: "#60646C",
  700: "#43484E",
  800: "#272A2D",
  900: "#1C2024",
  A100: "#F0F0F3",
  A200: "#E8E8EC",
  A400: "#B9BBC6",
  A700: "#43484E",
};

// Deep indigo ink behind the sign-in panel and landing hero, in both modes.
const brand = {
  background: "#141726",
  text: "#EDEEF0",
  textMuted: "#A3ACCB",
  hover: "rgba(158, 177, 255, 0.08)",
  activeBackground: "rgba(158, 177, 255, 0.14)",
  activeText: "#FFFFFF",
  activeIcon: "#9EB1FF",
  border: "rgba(158, 177, 255, 0.16)",
};

const lightPalette: PaletteOptions = {
  mode: "light",
  primary: {
    main: "#3E63DD",
    light: "#8DA4EF",
    dark: "#3358D4",
    contrastText: "#FFFFFF",
  },
  secondary: {
    main: "#60646C",
    light: "#8B8D98",
    dark: "#1C2024",
    contrastText: "#FFFFFF",
  },
  success: {
    main: "#208368",
    light: "#29A383",
    dark: "#1A7259",
    contrastText: "#FFFFFF",
  },
  warning: {
    main: "#AB6400",
    light: "#FFC53D",
    dark: "#9A5800",
    contrastText: "#FFFFFF",
  },
  error: {
    main: "#CE2C31",
    light: "#E5484D",
    dark: "#B3262B",
    contrastText: "#FFFFFF",
  },
  info: {
    main: "#0D74CE",
    light: "#5EB1EF",
    dark: "#0B68B9",
    contrastText: "#FFFFFF",
  },
  grey: slate,
  background: {
    default: "#F9F9FB",
    paper: "#FFFFFF",
    raised: "#FFFFFF",
    subtle: "#F9F9FB",
  },
  text: {
    primary: "#1C2024",
    secondary: "#60646C",
    disabled: "#8B8D98",
  },
  divider: "#E0E1E6",
  inputBorder: "#8B8D98",
  action: {
    hover: "rgba(28, 32, 36, 0.04)",
    selected: "rgba(62, 99, 221, 0.08)",
  },
  sidebar: {
    background: "#FFFFFF",
    text: "#1C2024",
    textMuted: "#60646C",
    hover: "rgba(28, 32, 36, 0.05)",
    activeBackground: "#EDF2FE",
    activeText: "#3A5BC7",
    activeIcon: "#3E63DD",
    border: "#E0E1E6",
  },
  brand,
  accentTone: { bg: "#EDF2FE", fg: "#3A5BC7" },
  status: {
    approved: { bg: "#E6F7ED", fg: "#1A7259" },
    pending: { bg: "#FFF7C2", fg: "#9A5800" },
    rejected: { bg: "#FEEBEC", fg: "#CE2C31" },
    draft: { bg: "#F0F0F3", fg: "#60646C" },
    info: { bg: "#E6F4FE", fg: "#0B68B9" },
  },
  // Categorical order validated for CVD separation (incl. donut wrap-around).
  chart: {
    series: "#3E63DD",
    reference: "#CDCED6",
    other: "#8B8D98",
    track: "#E8E8EC",
    categorical: [
      "#2563EB",
      "#0D9488",
      "#EA580C",
      "#DB2777",
      "#7C3AED",
      "#CA8A04",
      "#0891B2",
      "#65A30D",
    ],
  },
};

const darkPalette: PaletteOptions = {
  mode: "dark",
  // `main` is text-safe on dark surfaces; contained buttons fill with `dark` (components.ts).
  primary: {
    main: "#9EB1FF",
    light: "#D6E1FF",
    dark: "#3E63DD",
    contrastText: "#11131F",
  },
  secondary: {
    main: "#B0B4BA",
    light: "#EDEEF0",
    dark: "#777B84",
    contrastText: "#111113",
  },
  success: {
    main: "#1FD8A4",
    light: "#ADF0D4",
    dark: "#208368",
    contrastText: "#111113",
  },
  warning: {
    main: "#FFCA16",
    light: "#FFE7B3",
    dark: "#AB6400",
    contrastText: "#111113",
  },
  error: {
    main: "#FF9592",
    light: "#FFD1D9",
    dark: "#CE2C31",
    contrastText: "#111113",
  },
  info: {
    main: "#70B8FF",
    light: "#C2E6FF",
    dark: "#0D74CE",
    contrastText: "#111113",
  },
  grey: slate,
  background: {
    default: "#111113",
    paper: "#18191B",
    raised: "#212225",
    subtle: "#212225",
  },
  text: {
    primary: "#EDEEF0",
    secondary: "#B0B4BA",
    disabled: "#777B84",
  },
  divider: "#363A3F",
  inputBorder: "#696E77",
  action: {
    hover: "rgba(237, 238, 240, 0.06)",
    selected: "rgba(158, 177, 255, 0.12)",
  },
  sidebar: {
    background: "#18191B",
    text: "#EDEEF0",
    textMuted: "#B0B4BA",
    hover: "rgba(237, 238, 240, 0.06)",
    activeBackground: "rgba(158, 177, 255, 0.12)",
    activeText: "#EDEEF0",
    activeIcon: "#9EB1FF",
    border: "#363A3F",
  },
  brand,
  accentTone: { bg: "#182449", fg: "#9EB1FF" },
  status: {
    approved: { bg: "#0F2E22", fg: "#1FD8A4" },
    pending: { bg: "#302008", fg: "#FFCA16" },
    rejected: { bg: "#3B1219", fg: "#FF9592" },
    draft: { bg: "#272A2D", fg: "#B0B4BA" },
    info: { bg: "#0D2847", fg: "#70B8FF" },
  },
  chart: {
    series: "#9EB1FF",
    reference: "#43484E",
    other: "#777B84",
    track: "#272A2D",
    categorical: [
      "#3B82F6",
      "#0D9488",
      "#EA580C",
      "#DB2777",
      "#8B5CF6",
      "#A16207",
      "#0891B2",
      "#65A30D",
    ],
  },
};

export const getPalette = (mode: PaletteMode): PaletteOptions =>
  mode === "light" ? lightPalette : darkPalette;
