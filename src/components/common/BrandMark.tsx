import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import logoUrl from "../../assets/ledgerly_svg.svg";

const LOGO_SIZE = 36;

interface BrandMarkProps {
  /** Light wordmark for the ink brand panels. */
  inverse?: boolean;
  /** Links the mark to this path, e.g. "/" for home. */
  to?: string;
  /** Line under the wordmark, aligned with it. */
  subtitle?: ReactNode;
}

/** Ledgerly logo followed by the wordmark, used in the app shell, sign-in and landing pages. */
export function BrandMark({ inverse = false, to, subtitle }: BrandMarkProps) {
  const linkProps = to ? { component: RouterLink, to, "aria-label": "Ledgerly home" } : {};

  return (
    <Stack
      {...linkProps}
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", width: "fit-content", color: "inherit", textDecoration: "none" }}
    >
      <Box component="img" src={logoUrl} alt="" sx={{ display: "block", flexShrink: 0, width: LOGO_SIZE, height: LOGO_SIZE }} />
      <Stack sx={{ minWidth: 0 }}>
        <Typography
          variant="h6"
          component="span"
          sx={{ fontWeight: 700, lineHeight: 1.2, color: inverse ? "brand.activeText" : "text.primary" }}
        >
          Ledgerly
        </Typography>
        {subtitle && (
          <Typography variant="body2" component="span" sx={{ color: inverse ? "brand.textMuted" : "text.secondary" }}>
            {subtitle}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
