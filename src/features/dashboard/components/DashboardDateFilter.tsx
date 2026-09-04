import {
  Button,
  Stack,
  TextField,
} from "@mui/material";

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

  return (
    <Stack
      direction={{
        xs: "column",
        sm: "row",
      }}
      spacing={2}
    >
      <TextField
        label="Start date"
        type="date"
        value={value.startDate}
        error={isInvalidRange}
        helperText={
          isInvalidRange
            ? "Start date must be before end date."
            : undefined
        }
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

      <Button
        type="button"
        onClick={() =>
          onChange({
            startDate: "",
            endDate: "",
          })
        }
        disabled={
          !value.startDate &&
          !value.endDate
        }
        sx={{
          alignSelf: {
            xs: "flex-start",
            sm: "center",
          },
        }}
        
      >
        Clear
      </Button>
    </Stack>
  );
}