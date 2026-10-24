import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";

import { DateRangeFields } from "../../../components/common/DateRangeFields";
import { FilterBar } from "../../../components/common/FilterBar";
import {
  DASHBOARD_PRESETS,
  DEFAULT_DASHBOARD_PRESET,
  DEFAULT_DASHBOARD_RANGE,
  dashboardPresetRange,
  type DashboardDateRange,
  type DashboardPreset,
} from "../utils/dashboardRange";

interface DashboardDateFilterProps {
  value: DashboardDateRange;
  onChange: (value: DashboardDateRange) => void;
}

export function DashboardDateFilter({
  value,
  onChange,
}: DashboardDateFilterProps) {
  const activeCount = value.preset === DEFAULT_DASHBOARD_PRESET ? 0 : 1;

  const handlePreset = (preset: DashboardPreset | null) => {
    if (!preset) return;
    // Custom starts from the dates currently shown.
    onChange(preset === "custom" ? { ...value, preset } : dashboardPresetRange(preset));
  };

  return (
    <FilterBar
      label="Date range"
      activeCount={activeCount}
      onReset={() => onChange(DEFAULT_DASHBOARD_RANGE)}
    >
      <Box sx={{ overflowX: "auto", maxWidth: "100%" }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={value.preset}
          onChange={(_event, preset: DashboardPreset | null) => handlePreset(preset)}
          aria-label="Date range"
          sx={{ flexWrap: "nowrap" }}
        >
          {DASHBOARD_PRESETS.map((preset) => (
            <ToggleButton key={preset.value} value={preset.value} sx={{ whiteSpace: "nowrap", px: 1.5 }}>
              {preset.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {value.preset === "custom" && (
        <DateRangeFields
          fromLabel="Start date"
          toLabel="End date"
          value={{ from: value.startDate, to: value.endDate }}
          onChange={(range) => onChange({ preset: "custom", startDate: range.from, endDate: range.to })}
        />
      )}
    </FilterBar>
  );
}
