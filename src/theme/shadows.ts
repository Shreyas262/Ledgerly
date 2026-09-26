import type { PaletteMode, Shadows } from "@mui/material/styles";

// Restrained elevation scale: borders carry structure, shadows only hint at depth.
export const getShadows = (mode: PaletteMode): Shadows => {
  const rgb = mode === "light" ? "15, 23, 42" : "0, 0, 0";
  const k = mode === "light" ? 1 : 3;
  const c = (opacity: number) => `rgba(${rgb}, ${Math.min(opacity * k, 0.6)})`;

  const levels = {
    xs: `0 1px 2px ${c(0.05)}`,
    sm: `0 1px 3px ${c(0.06)}, 0 1px 2px ${c(0.04)}`,
    md: `0 4px 6px -1px ${c(0.06)}, 0 2px 4px -2px ${c(0.04)}`,
    lg: `0 10px 15px -3px ${c(0.08)}, 0 4px 6px -4px ${c(0.04)}`,
    xl: `0 20px 25px -5px ${c(0.1)}, 0 8px 10px -6px ${c(0.05)}`,
    xxl: `0 25px 50px -12px ${c(0.18)}`,
  };

  return Array.from({ length: 25 }, (_, index) => {
    if (index === 0) return "none";
    if (index === 1) return levels.xs;
    if (index === 2) return levels.sm;
    if (index <= 4) return levels.md;
    if (index <= 8) return levels.lg;
    if (index <= 16) return levels.xl;
    return levels.xxl;
  }) as Shadows;
};
