import { Badge, Box, Button, Card, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import type { AnalyticsFilterOptions, AnalyticsScope } from "../types/analytics";
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPES, type ExpenseType } from "../../expenses/types/expense";
import {
  DATE_PRESETS,
  countActiveFilters,
  presetRange,
  type AnalyticsFilterState,
  type DatePreset,
} from "../utils/analyticsFilters";

interface AnalyticsFilterBarProps {
  filters: AnalyticsFilterState;
  onChange: (filters: AnalyticsFilterState) => void;
  onReset: () => void;
  scope: AnalyticsScope;
  options: AnalyticsFilterOptions;
  rangeError: string | null;
}

export function AnalyticsFilterBar({ filters, onChange, onReset, scope, options, rangeError }: AnalyticsFilterBarProps) {
  const activeCount = countActiveFilters(filters);
  const teams = options.teams.filter((team) => !filters.departmentId || team.departmentId === filters.departmentId);
  const update = (patch: Partial<AnalyticsFilterState>) => onChange({ ...filters, ...patch });

  const handlePreset = (preset: DatePreset | null) => {
    if (!preset) return;
    update(preset === "custom" ? { preset } : { preset, ...presetRange(preset) });
  };

  const handleDepartment = (departmentId: string) => {
    const teamStillValid = options.teams.some((team) => team.id === filters.teamId && (!departmentId || team.departmentId === departmentId));
    update({ departmentId, teamId: teamStillValid ? filters.teamId : "" });
  };

  return (
    <Card
      component="section"
      aria-label="Analytics filters"
      sx={{
        p: 2,
        position: { md: "sticky" },
        top: { md: 72 },
        zIndex: (theme) => theme.zIndex.appBar - 1,
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2} sx={{ alignItems: { lg: "center" } }}>
          <Box sx={{ overflowX: "auto", maxWidth: "100%" }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filters.preset}
              onChange={(_event, value: DatePreset | null) => handlePreset(value)}
              aria-label="Date range"
              sx={{ flexWrap: "nowrap" }}
            >
              {DATE_PRESETS.map((preset) => (
                <ToggleButton key={preset.value} value={preset.value} sx={{ whiteSpace: "nowrap", px: 1.5 }}>
                  {preset.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          {filters.preset === "custom" && (
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                type="date"
                label="From"
                value={filters.from}
                onChange={(event) => update({ from: event.target.value })}
                error={Boolean(rangeError)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: filters.to || undefined } }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                value={filters.to}
                onChange={(event) => update({ to: event.target.value })}
                error={Boolean(rangeError)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: filters.from || undefined } }}
              />
            </Stack>
          )}
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, flexWrap: "wrap", rowGap: 1.5 }}>
          {scope !== "TEAM" && (
            <>
              <TextField
                select
                size="small"
                label="Department"
                value={filters.departmentId}
                onChange={(event) => handleDepartment(event.target.value)}
                sx={{ minWidth: 190 }}
              >
                <MenuItem value="">All departments</MenuItem>
                {options.departments.map((department) => (
                  <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Team"
                value={filters.teamId}
                onChange={(event) => update({ teamId: event.target.value })}
                sx={{ minWidth: 190 }}
                disabled={teams.length === 0}
              >
                <MenuItem value="">All teams</MenuItem>
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                ))}
              </TextField>
            </>
          )}
          <TextField
            select
            size="small"
            label="Expense type"
            value={filters.type}
            onChange={(event) => update({ type: event.target.value as ExpenseType | "" })}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">All expense types</MenuItem>
            {EXPENSE_TYPES.map((type) => (
              <MenuItem key={type} value={type}>{EXPENSE_TYPE_LABELS[type]}</MenuItem>
            ))}
          </TextField>

          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Badge badgeContent={activeCount} color="primary">
              <FilterListIcon color="action" />
            </Badge>
            <Typography variant="body2" color="text.secondary">
              {activeCount ? `${activeCount} active` : "Default view"}
            </Typography>
            <Button size="small" startIcon={<RestartAltIcon />} onClick={onReset} disabled={activeCount === 0}>
              Reset
            </Button>
          </Stack>
        </Stack>

        {rangeError && <Typography variant="body2" color="error">{rangeError}</Typography>}
      </Stack>
    </Card>
  );
}
