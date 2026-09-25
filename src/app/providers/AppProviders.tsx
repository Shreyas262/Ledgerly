import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Provider } from "react-redux";

import { AuthProvider } from "../../features/auth/context/AuthContext";
import { store } from "../../store/store";
import { createAppTheme } from "../../theme/theme";
import { getSettings } from "../../features/settings/utils/settingsStorage";
import type { ThemePreference } from "../../features/settings/types/settings";

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "light") {
    return "light";
  }

  if (preference === "dark") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function AppProviders({ children }: PropsWithChildren) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    () => getSettings().theme,
  );

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveTheme(themePreference),
  );

  useEffect(() => {
    const handleStorageChange = () => {
      const settings = getSettings();

      setThemePreference(settings.theme);
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    setResolvedTheme(resolveTheme(themePreference));
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = () => {
      setResolvedTheme(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [themePreference]);

  useEffect(() => {
    const handleSettingsChange = () => {
      setThemePreference(getSettings().theme);
    };

    window.addEventListener("ledgerly-settings-change", handleSettingsChange);

    return () => {
      window.removeEventListener(
        "ledgerly-settings-change",
        handleSettingsChange,
      );
    };
  }, []);

  const theme = useMemo(() => createAppTheme(resolvedTheme), [resolvedTheme]);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}
