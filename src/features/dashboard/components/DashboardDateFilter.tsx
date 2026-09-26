import { TextField } from "@mui/material";

import { FilterBar } from "../../../components/common/FilterBar";

export interface DashboardDateRange {
  startDate: string;
  endDate: string;
}

interface DashboardDateFilterProps {
  value: DashboardDateRange;
  onChange: (value: DashboardDateRange) => void;
}

export function DashboardDateFilter({
  value,
  onChange,
}: DashboardDateFilterProps) {
  const isInvalidRange =
    Boolean(value.startDate) &&
    Boolean(value.endDate) &&
    value.startDate > value.endDate;

  const activeCount = (value.startDate ? 1 : 0) + (value.endDate ? 1 : 0);

  return (
    <FilterBar
      label="Date range"
      activeCount={activeCount}
      onReset={() =>
        onChange({
          startDate: "",
          endDate: "",
        })
      }
      error={isInvalidRange ? "Start date must be before end date." : null}
    >
      <TextField
        size="small"
        label="Start date"
        type="date"
        value={value.startDate}
        error={isInvalidRange}
        onChange={(event) =>
          onChange({
            ...value,
            startDate: event.target.value,
          })
        }
        slotProps={{
          inputLabel: {
            shrink: true,
          },
        }}
      />

      <TextField
        size="small"
        label="End date"
        type="date"
        value={value.endDate}
        error={isInvalidRange}
        onChange={(event) =>
          onChange({
            ...value,
            endDate: event.target.value,
          })
        }
        slotProps={{
          inputLabel: {
            shrink: true,
          },
        }}
      />
    </FilterBar>
  );
}
