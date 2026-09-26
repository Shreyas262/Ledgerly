import type { ReactNode } from "react";
import { Divider, Stack, Typography } from "@mui/material";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Status chips shown beside the title. */
  chips?: ReactNode;
  /** Page-level actions aligned to the right. */
  actions?: ReactNode;
}

/** Standard page title block: title, optional description and actions, then a divider. */
export function PageHeader({ title, description, chips, actions }: PageHeaderProps) {
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "flex-end" },
        }}
      >
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h4">{title}</Typography>
            {chips}
          </Stack>
          {description && <Typography color="text.secondary">{description}</Typography>}
        </Stack>

        {actions && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexShrink: 0, flexWrap: "wrap" }}>
            {actions}
          </Stack>
        )}
      </Stack>

      <Divider />
    </Stack>
  );
}
