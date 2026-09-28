import type { ReactNode } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { keyframes, useTheme } from "@mui/material/styles";
import {
  AccountBalanceOutlined,
  ApartmentOutlined,
  ArrowForwardOutlined,
  CheckCircleOutlineOutlined,
  FactCheckOutlined,
  HistoryEduOutlined,
  InsightsOutlined,
  LockOutlined,
  PersonOutlineOutlined,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import { Link as RouterLink, Navigate } from "react-router-dom";

import logoUrl from "../assets/ledgerly_svg.svg";
import { useAuth } from "../features/auth/context/AuthContext";
import { LoadingState } from "../components/common/LoadingState";

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
`;

const entrance = (delayMs: number) => ({
  animation: `${riseIn} 480ms ease-out ${delayMs}ms both`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const PERSONAL_LOGIN = "/auth/login?type=personal";
const ORGANIZATION_LOGIN = "/auth/login";

interface EntryPath {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  to: string;
  secondary?: { label: string; to: string };
}

const entryPaths: EntryPath[] = [
  {
    icon: <PersonOutlineOutlined />,
    eyebrow: "For individuals",
    title: "Personal account",
    description: "Keep track of your own spending without spreadsheets.",
    points: [
      "Record expenses with payment method and receipts",
      "Set monthly budgets, with limits by type of spending",
      "Search and filter every transaction",
      "See trends and where your money goes",
    ],
    cta: "Personal Login",
    to: PERSONAL_LOGIN,
    secondary: { label: "Create an account", to: "/auth/register" },
  },
  {
    icon: <ApartmentOutlined />,
    eyebrow: "For teams and companies",
    title: "Organizational account",
    description: "Run expense management for your whole organization.",
    points: [
      "Expense submission with policy checks and approvals",
      "Budgets allocated across departments and teams",
      "Reimbursement processing by Finance",
      "Financial reporting and a complete audit trail",
    ],
    cta: "Organization Login",
    to: ORGANIZATION_LOGIN,
  },
];

const highlights = [
  { icon: <ReceiptLongOutlined />, title: "Receipts attached", text: "Keep JPG, PNG or PDF receipts next to the expense they belong to." },
  { icon: <AccountBalanceOutlined />, title: "Budgets that keep up", text: "Spending is measured against your budget as soon as it is recorded." },
  { icon: <InsightsOutlined />, title: "Useful analytics", text: "Monthly trends and breakdowns by type, ready when you need them." },
  { icon: <LockOutlined />, title: "Private by design", text: "Personal and organization data are kept completely separate." },
];

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Box component="img" src={logoUrl} alt="" sx={{ width: 36, height: 36 }} />
      <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: inverse ? "sidebar.activeText" : "text.primary" }}>
        Ledgerly
      </Typography>
    </Stack>
  );
}

/** Decorative ledger grid with a rising trend line, drawn in theme colours. */
function HeroGraphic() {
  const { palette } = useTheme();

  return (
    <Box aria-hidden sx={{ position: "absolute", right: { xs: -120, md: -40 }, bottom: -30, width: { xs: "140%", md: "60%" }, maxWidth: 760, opacity: 0.45, pointerEvents: "none" }}>
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

function EntryCard({ path, delay }: { path: EntryPath; delay: number }) {
  return (
    <Card sx={{ height: "100%", ...entrance(delay) }}>
      <CardContent sx={{ p: { xs: 3, md: 4 }, height: "100%", display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Box sx={{ display: "flex", p: 1.25, borderRadius: 1.5, bgcolor: "action.hover", color: "primary.main" }}>
            {path.icon}
          </Box>
          <Box>
            <Typography variant="overline" color="text.secondary">{path.eyebrow}</Typography>
            <Typography variant="h5" component="h3">{path.title}</Typography>
          </Box>
        </Stack>
        <Typography color="text.secondary">{path.description}</Typography>
        <List dense disablePadding sx={{ flex: 1 }}>
          {path.points.map((point) => (
            <ListItem key={point} disableGutters sx={{ alignItems: "flex-start" }}>
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5, color: "success.main" }}>
                <CheckCircleOutlineOutlined fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={point} />
            </ListItem>
          ))}
        </List>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button component={RouterLink} to={path.to} variant="contained" size="large" endIcon={<ArrowForwardOutlined />}>
            {path.cta}
          </Button>
          {path.secondary && (
            <Button component={RouterLink} to={path.secondary.to} variant="outlined" size="large">
              {path.secondary.label}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Public entry point: presents the personal and organizational paths into Ledgerly. */
export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  // Signed-in users go straight to their own start page.
  if (isAuthenticated) {
    return <Navigate to="/start" replace />;
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Hero */}
      <Box
        component="header"
        sx={{
          position: "relative",
          overflow: "hidden",
          color: "sidebar.text",
          bgcolor: "sidebar.background",
          backgroundImage: (theme) => theme.palette.sidebar.gradient,
        }}
      >
        <HeroGraphic />
        <Container maxWidth="lg" sx={{ position: "relative" }}>
          <Stack
            component="nav"
            aria-label="Sign in"
            direction="row"
            sx={{ py: 2.5, alignItems: "center", justifyContent: "space-between", gap: 2 }}
          >
            <BrandMark inverse />
            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
              <Button component={RouterLink} to={PERSONAL_LOGIN} sx={{ color: "sidebar.text" }}>
                Personal Login
              </Button>
              <Button component={RouterLink} to={ORGANIZATION_LOGIN} variant="outlined" sx={{ color: "sidebar.activeText", borderColor: "sidebar.border" }}>
                Organization Login
              </Button>
            </Stack>
          </Stack>

          <Stack spacing={3} sx={{ maxWidth: 680, pt: { xs: 6, md: 10 }, pb: { xs: 8, md: 14 } }}>
            <Typography variant="overline" sx={{ color: "sidebar.activeIcon", ...entrance(0) }}>
              Expense management, personal or organizational
            </Typography>
            <Typography variant="h2" component="h1" sx={{ color: "sidebar.activeText", fontSize: { xs: "2.25rem", md: "3.25rem" }, ...entrance(60) }}>
              Every expense, accounted for.
            </Typography>
            <Typography sx={{ color: "sidebar.textMuted", fontSize: { md: "1.125rem" }, ...entrance(120) }}>
              Ledgerly helps you record spending, keep receipts, stay within budget and understand where money goes —
              whether you are managing your own finances or your whole organization's.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={entrance(180)}>
              <Button
                component={RouterLink}
                to={PERSONAL_LOGIN}
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<PersonOutlineOutlined />}
              >
                Personal Login
              </Button>
              <Button
                component={RouterLink}
                to={ORGANIZATION_LOGIN}
                variant="outlined"
                size="large"
                startIcon={<ApartmentOutlined />}
                sx={{ color: "sidebar.activeText", borderColor: "sidebar.textMuted" }}
              >
                Organization Login
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="main">
        {/* Entry paths */}
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Stack spacing={1} sx={{ mb: 4, maxWidth: 640 }}>
            <Typography variant="h4" component="h2">Choose how you use Ledgerly</Typography>
            <Typography color="text.secondary">
              Two kinds of account, each with its own workspace. Your personal records are never visible to an organization.
            </Typography>
          </Stack>
          <Grid container spacing={3}>
            {entryPaths.map((path, index) => (
              <Grid key={path.title} size={{ xs: 12, md: 6 }}>
                <EntryCard path={path} delay={index * 80} />
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* Highlights */}
        <Box sx={{ borderTop: 1, borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
            <Grid container spacing={4}>
              {highlights.map((item) => (
                <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: "flex", width: "fit-content", p: 1, borderRadius: 1.5, bgcolor: "action.hover", color: "primary.main" }}>
                      {item.icon}
                    </Box>
                    <Typography variant="subtitle1" component="h3">{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.text}</Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Organization strengths */}
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Grid container spacing={4} sx={{ alignItems: "center" }}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack spacing={1.5}>
                <Typography variant="h4" component="h2">Built for organizations that need control</Typography>
                <Typography color="text.secondary">
                  Policies, approvals and budgets work together, so every organizational expense is checked, reviewed
                  and reported the same way.
                </Typography>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={2}>
                {[
                  { icon: <FactCheckOutlined />, title: "Policy-checked approvals", text: "Claims are checked against your rules and routed to the right reviewer." },
                  { icon: <AccountBalanceOutlined />, title: "Department and team budgets", text: "Allocations and utilisation stay current across the organization." },
                  { icon: <HistoryEduOutlined />, title: "Audit and reporting", text: "Every action is recorded, and analytics are scoped to each role." },
                ].map((item) => (
                  <Stack key={item.title} direction="row" spacing={2}>
                    <Box sx={{ display: "flex", flexShrink: 0, height: "fit-content", p: 1, borderRadius: 1.5, bgcolor: "action.hover", color: "primary.main" }}>
                      {item.icon}
                    </Box>
                    <Stack spacing={0.25}>
                      <Typography variant="subtitle1" component="h3">{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.text}</Typography>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider" }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ py: 3, alignItems: { sm: "center" }, justifyContent: "space-between" }}>
            <BrandMark />
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Ledgerly
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
