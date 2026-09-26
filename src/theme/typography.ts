import type { TypographyVariantsOptions } from "@mui/material/styles";

const headingStyle = {
  fontWeight: 600,
  letterSpacing: "-0.01em",
};

export const typography: TypographyVariantsOptions = {
  fontFamily:
    '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 600,

  h1: { ...headingStyle, fontSize: "2.5rem", lineHeight: 1.2 },
  h2: { ...headingStyle, fontSize: "2.25rem", lineHeight: 1.2 },
  h3: { ...headingStyle, fontSize: "2rem", lineHeight: 1.25 },
  // Page title
  h4: { ...headingStyle, fontSize: "1.875rem", lineHeight: 1.25 },
  h5: { ...headingStyle, fontSize: "1.25rem", lineHeight: 1.35 },
  // Section title
  h6: { ...headingStyle, fontSize: "1.125rem", lineHeight: 1.4 },
  // Card titles
  subtitle1: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.5 },
  subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: "0.875rem", lineHeight: 1.6 },
  body2: { fontSize: "0.8125rem", lineHeight: 1.55 },
  caption: { fontSize: "0.75rem", lineHeight: 1.5 },
  overline: {
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    lineHeight: 1.5,
  },
  button: {
    fontSize: "0.875rem",
    fontWeight: 600,
    textTransform: "none",
    letterSpacing: 0,
  },
  // KPI / headline financial figures
  kpi: {
    fontSize: "1.625rem",
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
    fontVariantNumeric: "tabular-nums",
  },
  // Inline monetary values: inherits size and colour from the surrounding text
  amount: {
    fontVariantNumeric: "tabular-nums",
  },
};
