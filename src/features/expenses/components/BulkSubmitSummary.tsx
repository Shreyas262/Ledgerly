import { Alert, Box, Typography } from "@mui/material";

export interface BulkSubmitOutcome {
  submitted: number;
  failures: { title: string; message: string }[];
}

interface BulkSubmitSummaryProps {
  outcome: BulkSubmitOutcome;
  onClose: () => void;
}

const expenses = (count: number) => `${count} ${count === 1 ? "expense" : "expenses"}`;

/** What happened when several drafts were submitted at once. */
export function BulkSubmitSummary({ outcome, onClose }: BulkSubmitSummaryProps) {
  const { submitted, failures } = outcome;

  return (
    <Alert severity={failures.length ? "warning" : "success"} onClose={onClose}>
      {submitted > 0 && <Typography variant="body2">{expenses(submitted)} submitted for approval.</Typography>}
      {failures.length > 0 && (
        <>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {expenses(failures.length)} could not be submitted and {failures.length === 1 ? "remains" : "remain"} selected:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {failures.map((failure) => (
              <Typography component="li" variant="body2" key={failure.title + failure.message}>
                "{failure.title}": {failure.message}
              </Typography>
            ))}
          </Box>
        </>
      )}
    </Alert>
  );
}
