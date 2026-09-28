import { Box, Stack, Typography } from "@mui/material";
import { PieChart } from "@mui/x-charts/PieChart";

import { ChartCard } from "../../../components/common/ChartCard";
import { Amount } from "../../../components/common/Amount";
import { formatCurrency } from "../../../utils/currency";
import { PERSONAL_EXPENSE_TYPE_LABELS, type PersonalTypeBreakdown } from "../types/personal";
import { usePersonalTypeColor } from "../utils/personalFormat";

interface PersonalTypeBreakdownChartProps {
  data: PersonalTypeBreakdown[];
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
}

/** Share of spending by expense type, as a donut with a ranked legend. */
export function PersonalTypeBreakdownChart({
  data,
  title = "Spending by type",
  subtitle,
  emptyMessage = "No spending in this period.",
}: PersonalTypeBreakdownChartProps) {
  const colorOf = usePersonalTypeColor();
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <ChartCard title={title} subtitle={subtitle} isEmpty={data.length === 0} emptyMessage={emptyMessage}>
      <Stack direction={{ xs: "column", sm: "row", md: "column", lg: "row" }} spacing={3} sx={{ alignItems: "center" }}>
        <Box sx={{ position: "relative", width: 200, height: 200, flexShrink: 0 }}>
          <PieChart
            width={200}
            height={200}
            hideLegend
            margin={0}
            series={[{
              data: data.map((item) => ({
                id: item.type,
                value: item.amount,
                label: PERSONAL_EXPENSE_TYPE_LABELS[item.type],
                color: colorOf(item.type),
              })),
              innerRadius: 64,
              outerRadius: 96,
              paddingAngle: 2,
              cornerRadius: 4,
              valueFormatter: (item) => formatCurrency(item.value),
            }]}
          />
          <Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <Typography variant="caption" color="text.secondary">Total</Typography>
            <Typography variant="subtitle1"><Amount value={total} /></Typography>
          </Stack>
        </Box>
        <Stack spacing={1} sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          {data.map((item) => (
            <Stack key={item.type} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: colorOf(item.type), flexShrink: 0 }} />
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                {PERSONAL_EXPENSE_TYPE_LABELS[item.type]}
                <Typography component="span" variant="caption" color="text.secondary"> · {item.count}</Typography>
              </Typography>
              <Typography variant="subtitle2"><Amount value={item.amount} /></Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 36, textAlign: "right" }}>
                {total ? `${((item.amount / total) * 100).toFixed(0)}%` : "0%"}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </ChartCard>
  );
}
