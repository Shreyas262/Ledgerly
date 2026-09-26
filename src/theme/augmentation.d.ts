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
  series: string;
  track: string;
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
    amount: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    kpi?: React.CSSProperties;
    amount?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    kpi: true;
    amount: true;
  }
}
