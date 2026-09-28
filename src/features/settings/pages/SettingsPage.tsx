import { useState, type FormEvent, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import SettingsBrightnessOutlined from "@mui/icons-material/SettingsBrightnessOutlined";

import { BackLink } from "../../../components/navigation/BackLink";
import { PageHeader } from "../../../components/common/PageHeader";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { useAuth } from "../../auth/context/AuthContext";
import { isPersonalAccount } from "../../auth/utils/accountType";
import { useSettings } from "../hooks/useSettings";
import { resetSettings } from "../utils/settingsStorage";
import { useChangePasswordMutation, useGetSessionsQuery, useRevokeOtherSessionsMutation } from "../api/securityApi";
import type { NotificationCategory, StartPage, ThemePreference } from "../types/settings";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { formatDateTime } from "../../../utils/format";

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">{description}</Typography>
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

const NOTIFICATION_OPTIONS: Array<{ category: NotificationCategory; label: string; help: string; reviewersOnly?: boolean }> = [
  { category: "EXPENSE_UPDATES", label: "Updates on my expenses", help: "When a review starts, or an expense is approved, rejected or cancelled." },
  { category: "REIMBURSEMENTS", label: "Reimbursements", help: "When reimbursement of your expense starts and when it is paid." },
  { category: "POLICY_ALERTS", label: "Policy notices", help: "When you submit an expense with policy warnings or above an approval threshold." },
  { category: "REVIEW_QUEUE", label: "Work waiting for me", help: "Expenses waiting for your review or reimbursement.", reviewersOnly: true },
  { category: "BUDGET_ALERTS", label: "Budget notices", help: "When expenses cannot be created because of the budget, and, for administrators, when a budget period has ended." },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { can } = usePermissions();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [saved, setSaved] = useState<string | null>(null);
  const isReviewer = can("expenses.approve") || can("reimbursements.manage");
  const personal = isPersonalAccount(user);
  // Organization defaults do not apply to personal accounts, and vice versa.
  const startPage = personal
    ? (settings.startPage.startsWith("/personal/") ? settings.startPage : "/personal/dashboard")
    : (settings.startPage.startsWith("/personal/") ? "/dashboard" : settings.startPage);

  const { data: sessions } = useGetSessionsQuery();
  const [changePassword, { isLoading: changing, error: passwordError, reset: resetPasswordState }] = useChangePasswordMutation();
  const [revokeOthers, { isLoading: revoking, error: revokeError }] = useRevokeOtherSessionsMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const passwordDetails = getApiErrorDetails(passwordError);

  const change = (updates: Parameters<typeof update>[0]) => {
    update(updates);
    setSaved("Your settings have been saved.");
  };

  const handleReset = async () => {
    if (!(await confirm({
      title: "Reset Preferences",
      message: personal
        ? "Restore theme and start page preferences to their defaults?"
        : "Restore theme, start page and notification preferences to their defaults?",
      confirmLabel: "Reset",
      destructive: true,
    }))) return;
    resetSettings();
    setSaved("Your preferences have been reset.");
  };

  const handlePasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    if (!(await confirm({
      title: "Change Password",
      message: "Change your password? You will stay signed in here, and any other sessions will be signed out.",
      confirmLabel: "Change Password",
    }))) return;
    try {
      const result = await changePassword({ currentPassword, newPassword }).unwrap();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(result.revokedSessions
        ? `Your password has been changed and ${result.revokedSessions} other ${result.revokedSessions === 1 ? "session was" : "sessions were"} signed out.`
        : "Your password has been changed.");
    } catch {
      // The reason is shown by the form.
    }
  };

  const handleRevokeOthers = async () => {
    if (!(await confirm({
      title: "Sign Out of Other Sessions",
      message: "Sign out of Ledgerly everywhere except this browser?",
      confirmLabel: "Sign Out",
      destructive: true,
    }))) return;
    try {
      const result = await revokeOthers().unwrap();
      setSaved(`${result.revokedSessions} other ${result.revokedSessions === 1 ? "session was" : "sessions were"} signed out.`);
    } catch {
      // The reason is shown below.
    }
  };

  const otherSessions = sessions?.otherActiveSessions ?? 0;

  return (
    <Stack spacing={3}>
      <BackLink to="/account" label="Account" />
      <PageHeader
        title="Settings"
        description="Your preferences are saved automatically for your account on this device."
      />

      <Section title="Appearance" description="Choose how Ledgerly looks.">
        <ToggleButtonGroup
          exclusive
          value={settings.theme}
          onChange={(_event, value: ThemePreference | null) => value && change({ theme: value })}
          aria-label="Theme"
          sx={{ flexWrap: "wrap" }}
        >
          <ToggleButton value="system" sx={{ px: 2.5, gap: 1 }}><SettingsBrightnessOutlined fontSize="small" />System</ToggleButton>
          <ToggleButton value="light" sx={{ px: 2.5, gap: 1 }}><LightModeOutlined fontSize="small" />Light</ToggleButton>
          <ToggleButton value="dark" sx={{ px: 2.5, gap: 1 }}><DarkModeOutlined fontSize="small" />Dark</ToggleButton>
        </ToggleButtonGroup>
      </Section>

      <Section title="Start page" description="The page that opens after you sign in.">
        <TextField
          select
          label="Start page"
          value={startPage}
          onChange={(event) => change({ startPage: event.target.value as StartPage })}
          sx={{ maxWidth: 360 }}
        >
          {personal
            ? [
                <MenuItem key="dashboard" value="/personal/dashboard">Dashboard</MenuItem>,
                <MenuItem key="expenses" value="/personal/expenses">Expenses</MenuItem>,
              ]
            : [
                <MenuItem key="dashboard" value="/dashboard">Dashboard</MenuItem>,
                can("expenses.read") && <MenuItem key="expenses" value="/expenses">Expenses</MenuItem>,
                isReviewer && <MenuItem key="approvals" value="/approvals">Approvals</MenuItem>,
              ]}
        </TextField>
      </Section>

      {/* Notifications cover organization workflows only. */}
      {!personal && <Section title="Notifications" description="Choose which notifications appear under the bell in the top bar.">
        <Stack spacing={1.5}>
          {NOTIFICATION_OPTIONS.filter((option) => !option.reviewersOnly || isReviewer).map((option) => (
            <FormControlLabel
              key={option.category}
              sx={{ alignItems: "flex-start", m: 0 }}
              control={
                <Switch
                  checked={settings.notifications[option.category]}
                  onChange={(event) => change({ notifications: { ...settings.notifications, [option.category]: event.target.checked } })}
                />
              }
              label={
                <Box sx={{ pt: 0.75 }}>
                  <Typography variant="subtitle2">{option.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{option.help}</Typography>
                </Box>
              }
            />
          ))}
        </Stack>
      </Section>}

      <Section title="Security" description={`Password and sign-in sessions for ${user?.email ?? "your account"}.`}>
        <Stack component="form" spacing={2} onSubmit={handlePasswordChange} sx={{ maxWidth: 480 }} noValidate>
          <Typography variant="subtitle2">Change password</Typography>
          {passwordError && !passwordDetails.fieldErrors && <ApiFeedback error={passwordError} />}
          <TextField
            type="password"
            label="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => { setCurrentPassword(event.target.value); resetPasswordState(); }}
            error={Boolean(passwordDetails.fieldErrors?.currentPassword)}
            helperText={passwordDetails.fieldErrors?.currentPassword?.toString()}
            required
          />
          <TextField
            type="password"
            label="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => { setNewPassword(event.target.value); resetPasswordState(); }}
            error={Boolean(passwordDetails.fieldErrors?.newPassword)}
            helperText={passwordDetails.fieldErrors?.newPassword?.toString()}
            required
          />
          <TextField
            type="password"
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => { setConfirmPassword(event.target.value); setMismatch(false); }}
            error={mismatch}
            helperText={mismatch ? "The passwords do not match." : undefined}
            required
          />
          <Box>
            <Button
              type="submit"
              variant="contained"
              disabled={changing || !currentPassword || !newPassword || !confirmPassword}
              sx={{ minWidth: 180 }}
            >
              {changing ? "Changing…" : "Change Password"}
            </Button>
          </Box>
        </Stack>

        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Sessions</Typography>
          <Typography variant="body2" color="text.secondary">
            {sessions?.current ? `This session started on ${formatDateTime(sessions.current.createdAt)}. ` : ""}
            {otherSessions
              ? `You are also signed in on ${otherSessions} other ${otherSessions === 1 ? "session" : "sessions"}.`
              : "You are not signed in anywhere else."}
          </Typography>
          {revokeError && <ApiFeedback error={revokeError} />}
          <Box>
            <Button variant="outlined" color="error" onClick={handleRevokeOthers} disabled={revoking || otherSessions === 0} sx={{ minWidth: 180 }}>
              {revoking ? "Signing Out…" : "Sign Out of Other Sessions"}
            </Button>
          </Box>
        </Stack>
      </Section>

      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" onClick={handleReset} sx={{ minWidth: 180 }}>
          Reset Preferences
        </Button>
      </Stack>

      <Snackbar
        open={Boolean(saved)}
        autoHideDuration={3000}
        onClose={() => setSaved(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSaved(null)}>{saved}</Alert>
      </Snackbar>
    </Stack>
  );
}
