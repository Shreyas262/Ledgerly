import type { ReactNode } from "react";
import { Badge, Button, Card, Stack, Typography } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

interface FilterBarProps {
  /** Filter fields; give them `size="small"`. */
  children: ReactNode;
  /** Number of filters that differ from the default view. */
  activeCount: number;
  onReset: () => void;
  label?: string;
  error?: string | null;
}

/** Standard container for page filters: wrapping fields, active count and reset. */
export function FilterBar({ children, activeCount, onReset, label = "Filters", error }: FilterBarProps) {
  return (
    <Card component="section" aria-label={label} sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          useFlexGap
          sx={{
            alignItems: { sm: "center" },
            flexWrap: "wrap",
            "& > .MuiFormControl-root": { flex: { sm: "1 1 190px" }, minWidth: 0 },
          }}
        >
          {children}

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0, ml: { sm: "auto" } }}>
            <Badge badgeContent={activeCount} color="primary">
              <FilterListIcon color="action" />
            </Badge>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {activeCount ? `${activeCount} active` : "Default view"}
            </Typography>
            <Button size="small" startIcon={<RestartAltIcon />} onClick={onReset} disabled={activeCount === 0}>
              Reset
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
      </Stack>
    </Card>
  );
}
