import "@mui/material/styles";
import "@mui/material/Typography";

interface LedgerlySidebarPalette {
  /** Solid fallback behind the gradients. */
  background: string;
  gradient: string;
  topbarGradient: string;
  text: string;
  textMuted: string;
  hover: string;
  activeBackground: string;
  activeText: string;
  activeIcon: string;
  border: string;
}

interface LedgerlyChartPalette {
  /** Single-series marks (spend lines, bars, sparklines). */
  series: string;
  /** Comparison / reference marks, e.g. budget allocation. */
  reference: string;
  /** Neutral "Other" / inactive category. */
  other: string;
  track: string;
  /** Validated categorical order; assign by entity, never by rank. */
  categorical: string[];
}

interface LedgerlyStatusTone {
  bg: string;
  fg: string;
}

interface LedgerlyStatusPalette {
  approved: LedgerlyStatusTone;
  pending: LedgerlyStatusTone;
  rejected: LedgerlyStatusTone;
  draft: LedgerlyStatusTone;
  info: LedgerlyStatusTone;
}

declare module "@mui/material/styles" {
  interface Palette {
    sidebar: LedgerlySidebarPalette;
    status: LedgerlyStatusPalette;
    chart: LedgerlyChartPalette;
  }

  interface PaletteOptions {
    sidebar?: LedgerlySidebarPalette;
    status?: LedgerlyStatusPalette;
    chart?: LedgerlyChartPalette;
  }

  interface TypographyVariants {
    kpi: React.CSSProperties;
    numeric: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    kpi?: React.CSSProperties;
    numeric?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    kpi: true;
    numeric: true;
  }
}
