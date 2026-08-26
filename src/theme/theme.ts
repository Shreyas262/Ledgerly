import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2563EB",
    },
    background: {
      default: "#F8FAFC",
      paper: "#FFFFFF",
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