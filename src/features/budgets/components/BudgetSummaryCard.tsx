import {
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";

interface BudgetSummaryCardProps {
  label: string;
  value: string;
  description?: string;
}

export function BudgetSummaryCard({
  label,
  value,
  description,
}: BudgetSummaryCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {label}
          </Typography>

          <Typography variant="h5">
            {value}
          </Typography>

          {description && (
            <Typography
              variant="body2"
              color="text.secondary"
            >
              {description}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}