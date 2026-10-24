import { DateRangeFields } from "../../../components/common/DateRangeFields";
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
    >
      <DateRangeFields
        fromLabel="Start date"
        toLabel="End date"
        value={{ from: value.startDate, to: value.endDate }}
        onChange={(range) => onChange({ startDate: range.from, endDate: range.to })}
      />
    </FilterBar>
  );
}
