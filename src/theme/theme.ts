import { createTheme } from "@mui/material/styles";

export const createAppTheme = (
  mode: "light" | "dark",
) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: "#2563EB",
      },
      background:
        mode === "light"
          ? {
              default: "#F8FAFC",
              paper: "#FFFFFF",
            }
          : {
              default: "#0F172A",
              paper: "#1E293B",
            },
    },

    components: {
      MuiButtonBase: {
        styleOverrides: {
          root: {
            "&:focus-visible": {
              outline: "3px solid",
              outlineOffset: "2px",
            },
          },
        },
      },
    },
  });