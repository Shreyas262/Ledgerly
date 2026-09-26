import { BackLink } from "../../../components/navigation/BackLink";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

import type { ThemePreference, UserSettings } from "../types/settings";
import {
  getSettings,
  resetSettings,
  saveSettings,
} from "../utils/settingsStorage";
import { PageHeader } from "../../../components/common/PageHeader";

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(() => getSettings());

  const [showSuccess, setShowSuccess] = useState(false);
  const confirm = useConfirm();

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...updates,
    }));

    setShowSuccess(false);
  };

  const handleSave = async () => {
    if (!(await confirm({ title: "Save settings", message: "Save your preference changes?", confirmLabel: "Save" }))) return;

    saveSettings(settings);
    setShowSuccess(true);
  };

  const handleReset = async () => {
    if (!(await confirm({
      title: "Reset settings",
      message: "Restore all preferences to their defaults? Your current choices will be lost.",
      confirmLabel: "Reset",
      destructive: true,
    }))) return;

    const defaultSettings = resetSettings();

    setSettings(defaultSettings);
    setShowSuccess(true);
  };

  return (
    <Stack spacing={3}>
      <BackLink to="/account" label="Account" />
      <PageHeader
        title="Settings"
        description="Manage your Ledgerly application preferences."
      />

      {showSuccess && (
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Settings saved successfully.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={0.5}>
              <Typography variant="h6">Appearance</Typography>

              <Typography variant="body2" color="text.secondary">
                Choose how Ledgerly should appear.
              </Typography>
            </Stack>

            <FormControl fullWidth>
              <InputLabel id="theme-preference-label">Theme</InputLabel>

              <Select
                labelId="theme-preference-label"
                value={settings.theme}
                label="Theme"
                onChange={(event) =>
                  updateSettings({
                    theme: event.target.value as ThemePreference,
                  })
                }
              >
                <MenuItem value="system">System</MenuItem>

                <MenuItem value="light">Light</MenuItem>

                <MenuItem value="dark">Dark</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            <Stack spacing={0.5}>
              <Typography variant="h6">Regional</Typography>

              <Typography variant="body2" color="text.secondary">
                Regional preferences used throughout Ledgerly.
              </Typography>
            </Stack>

            <FormControl fullWidth>
              <InputLabel id="currency-label">Currency</InputLabel>

              <Select
                labelId="currency-label"
                value={settings.currency}
                label="Currency"
                disabled
              >
                <MenuItem value="INR">INR — Indian Rupee</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            <Stack spacing={0.5}>
              <Typography variant="h6">Notifications</Typography>

              <Typography variant="body2" color="text.secondary">
                Control expense-related notifications.
              </Typography>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.expenseNotifications}
                  onChange={(event) =>
                    updateSettings({
                      expenseNotifications: event.target.checked,
                    })
                  }
                />
              }
              label="Expense notifications"
            />

            <Divider />

            <Stack
              direction="row"
              spacing={2}
              sx={{
                justifyContent: "flex-end",
              }}
            >
              <Button variant="outlined" onClick={handleReset}>
                Reset
              </Button>

              <Button variant="contained" onClick={handleSave}>
                Save Changes
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
