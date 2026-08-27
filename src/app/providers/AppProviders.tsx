import type { PropsWithChildren } from "react";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { Provider } from "react-redux";
import { AuthProvider } from "../../features/auth/context/AuthContext";

import { store } from "../../store/store";
import { theme } from "../../theme/theme";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}