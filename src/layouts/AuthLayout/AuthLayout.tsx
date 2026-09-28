import { Box, Stack, Typography } from "@mui/material";
import { keyframes, useTheme } from "@mui/material/styles";
import {
  AccountBalanceOutlined,
  FactCheckOutlined,
  HistoryEduOutlined,
} from "@mui/icons-material";
import type { ReactNode } from "react";

import logoUrl from "../../assets/ledgerly_svg.svg";

interface AuthLayoutProps {
  children: ReactNode;
}

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
`;

/** Entrance motion, disabled for users who prefer reduced motion. */
const entrance = (delayMs: number) => ({
  animation: `${riseIn} 480ms ease-out ${delayMs}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const features = [
  { icon: <FactCheckOutlined />, title: "Policy-checked expenses", text: "Every claim is checked against your rules before it is approved." },
  { icon: <AccountBalanceOutlined />, title: "Budgets tracked as you spend", text: "Allocations and utilisation stay current across departments and teams." },
  { icon: <HistoryEduOutlined />, title: "A complete audit trail", text: "Every action is recorded, read-only and attributable." },
];

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Box component="img" src={logoUrl} alt="" sx={{ width: 40, height: 40 }} />
      <Typography variant="h6" component="div" sx={{ fontWeight: 700, color: inverse ? "sidebar.activeText" : "text.primary" }}>
        Ledgerly
      </Typography>
    </Stack>
  );
}

/** Decorative ledger grid with a rising trend line, drawn in theme colours. */
function LedgerGraphic() {
  const { palette } = useTheme();

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        right: -40,
        bottom: -20,
        width: "85%",
        maxWidth: 640,
        opacity: 0.5,
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 600 400" width="100%" role="presentation">
        {Array.from({ length: 7 }, (_, row) => (
          <line key={`h${row}`} x1="0" x2="600" y1={row * 60 + 20} y2={row * 60 + 20} stroke={palette.sidebar.textMuted} strokeOpacity="0.14" />
        ))}
        {Array.from({ length: 11 }, (_, col) => (
          <line key={`v${col}`} y1="0" y2="400" x1={col * 60} x2={col * 60} stroke={palette.sidebar.textMuted} strokeOpacity="0.08" />
        ))}
        <polyline
          points="0,330 90,300 180,312 270,240 360,256 450,170 540,120 600,96"
          fill="none"
          stroke={palette.sidebar.activeIcon}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 5fr) minmax(0, 6fr)" },
        bgcolor: "background.default",
      }}
    >
      {/* Brand panel */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          position: "relative",
          overflow: "hidden",
          flexDirection: "column",
          justifyContent: "space-between",
          p: { md: 5, lg: 7 },
          color: "sidebar.text",
          bgcolor: "sidebar.background",
          backgroundImage: (theme) => theme.palette.sidebar.gradient,
        }}
      >
        <LedgerGraphic />

        <Box sx={{ position: "relative", ...entrance(0) }}>
          <BrandMark inverse />
        </Box>

        <Stack spacing={4} sx={{ position: "relative", maxWidth: 440, ...entrance(120) }}>
          <Stack spacing={1.5}>
            <Typography variant="h3" component="p" sx={{ color: "sidebar.activeText" }}>
              Precision finance for every expense.
            </Typography>
            <Typography sx={{ color: "sidebar.textMuted" }}>
              Submit, approve, reimburse and report on organisational spend — with policies and budgets enforced at every step.
            </Typography>
          </Stack>

          <Stack spacing={2.5}>
            {features.map((feature) => (
              <Stack key={feature.title} direction="row" spacing={2}>
                <Box
                  sx={{
                    display: "flex",
                    flexShrink: 0,
                    p: 1,
                    height: "fit-content",
                    borderRadius: 1.5,
                    bgcolor: "sidebar.activeBackground",
                    color: "sidebar.activeIcon",
                  }}
                >
                  {feature.icon}
                </Box>
                <Stack spacing={0.25}>
                  <Typography variant="subtitle2" sx={{ color: "sidebar.activeText" }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "sidebar.textMuted" }}>
                    {feature.text}
                  </Typography>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Stack>

        <Typography variant="caption" sx={{ position: "relative", color: "sidebar.textMuted" }}>
          © {new Date().getFullYear()} Ledgerly
        </Typography>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 2, sm: 4 },
          py: { xs: 5, md: 4 },
        }}
      >
        <Stack spacing={4} sx={{ width: "100%", maxWidth: 400, ...entrance(80) }}>
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            <BrandMark />
          </Box>
          {children}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: { md: "none" }, mt: 5 }}>
          © {new Date().getFullYear()} Ledgerly
        </Typography>
      </Box>
    </Box>
  );
}
