import { Box, Grid, Stack, Typography } from "@mui/material";

const categories = [
  { label: "Travel", value: "₹1,82,400" },
  { label: "Meals", value: "₹96,200" },
  { label: "Office", value: "₹54,800" },
  { label: "Entertainment", value: "₹42,100" },
];

const departments = [
  { label: "Engineering", value: "₹1,76,500" },
  { label: "Sales", value: "₹1,24,800" },
  { label: "Marketing", value: "₹86,400" },
  { label: "Operations", value: "₹62,700" },
];

interface BreakdownListProps {
  title: string;
  items: {
    label: string;
    value: string;
  }[];
}

function BreakdownList({
  title,
  items,
}: BreakdownListProps) {
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{fontWeight: 600}}>
        {title}
      </Typography>

      <Stack spacing={1.5}>
        {items.map((item) => (
          <Box
            key={item.label}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Typography variant="body2">
              {item.label}
            </Typography>

            <Typography
              variant="body2"
              sx={{fontWeight: 600}}
            >
              {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

export function SpendingBreakdown() {
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <BreakdownList
          title="By Category"
          items={categories}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <BreakdownList
          title="By Department"
          items={departments}
        />
      </Grid>
    </Grid>
  );
}