import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Provider } from "react-redux";

import { AuthProvider, useAuth } from "../../features/auth/context/AuthContext";
import { ConfirmProvider } from "../../components/common/ConfirmProvider";
import { store } from "../../store/store";
import { createAppTheme } from "../../theme/theme";
import { setSettingsUser } from "../../features/settings/utils/settingsStorage";
import { useSettings } from "../../features/settings/hooks/useSettings";

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

/** Applies the signed-in user's theme preference (§30.12). */
function ThemedApp({ children }: PropsWithChildren) {
  const { user } = useAuth();
  // Preferences are per user; switch storage before reading them.
  setSettingsUser(user?.id ?? null, false);
  const { settings } = useSettings();
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const mode = settings.theme === "system" ? (systemDark ? "dark" : "light") : settings.theme;
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ConfirmProvider>{children}</ConfirmProvider>
    </ThemeProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <AuthProvider>
        <ThemedApp>{children}</ThemedApp>
      </AuthProvider>
    </Provider>
  );
}
