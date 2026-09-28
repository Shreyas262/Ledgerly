import { useTheme } from "@mui/material";

import { EXPENSE_TYPES, type ExpenseStatus, type ExpenseType } from "../../expenses/types/expense";

/** Chart colours resolved from the active theme, so charts follow light/dark mode. */
export function useChartColors() {
  const { palette } = useTheme();
  const { chart } = palette;

  // Colour follows the entity: each type keeps its slot whatever the filters show.
  const expenseType = (type: ExpenseType): string => {
    if (type === "OTHER") return chart.other;
    const index = EXPENSE_TYPES.filter((item) => item !== "OTHER").indexOf(type);
    return chart.categorical[index % chart.categorical.length];
  };

  const status: Record<ExpenseStatus, string> = {
    draft: chart.other,
    submitted: palette.info.main,
    under_review: palette.info.main,
    approved: palette.success.main,
    reimbursement_pending: palette.warning.main,
    reimbursed: palette.success.dark,
    rejected: palette.error.main,
    cancelled: chart.other,
  };

  return {
    series: chart.series,
    reference: chart.reference,
    expenseType,
    status,
    success: palette.success.main,
    warning: palette.warning.main,
    error: palette.error.main,
  };
}
