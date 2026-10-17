import type { ReactNode } from "react";
import { Button, Checkbox, FormControlLabel, Paper, Stack, Typography } from "@mui/material";

interface BulkActionBarProps {
  /** How many items are selected. */
  selectedCount: number;
  /** How many items on the page can be selected. */
  selectableCount: number;
  /** Label of the select-all checkbox, e.g. "Select All Drafts". */
  selectAllLabel: string;
  onSelectAll: (selected: boolean) => void;
  onClear: () => void;
  /** The actions for the selection. */
  children: ReactNode;
}

/** Selection summary and actions above a list whose items can be selected. */
export function BulkActionBar({
  selectedCount,
  selectableCount,
  selectAllLabel,
  onSelectAll,
  onClear,
  children,
}: BulkActionBarProps) {
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <FormControlLabel
            label={selectAllLabel}
            control={
              <Checkbox
                checked={allSelected}
                indeterminate={selectedCount > 0 && !allSelected}
                onChange={(event) => onSelectAll(event.target.checked)}
              />
            }
          />
          <Typography variant="body2" color="text.secondary" role="status">
            {selectedCount} selected
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button onClick={onClear} disabled={selectedCount === 0}>
            Clear
          </Button>
          {children}
        </Stack>
      </Stack>
    </Paper>
  );
}
