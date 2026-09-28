import { createTheme } from "@mui/material/styles";

import { components } from "./components";
import { getPalette } from "./palette";
import { getShadows } from "./shadows";
import { typography } from "./typography";

export const createAppTheme = (
  mode: "light" | "dark",
) =>
  createTheme({
    palette: getPalette(mode),
    typography,
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
    shadows: getShadows(mode),
    components,
  });
