import { useState, type FormEvent } from "react";
import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";

import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useConfirm } from "../../../components/common/useConfirm";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { formatDate, humanize, toDateOnly } from "../../../utils/format";
import { useCreateDelegationMutation } from "../api/delegationApi";
import { MAX_DELEGATION_DAYS, type DelegationCandidate } from "../types/delegation";

interface DelegationFormProps {
  candidates: DelegationCandidate[];
  onDelegated: (message: string) => void;
}

/** Chooses a delegate and a period, confirmed before it is saved (§22.12). */
export function DelegationForm({ candidates, onDelegated }: DelegationFormProps) {
  const confirm = useConfirm();
  const [createDelegation, { isLoading, error, reset }] = useCreateDelegationMutation();
  const [delegateId, setDelegateId] = useState("");
  const [startDate, setStartDate] = useState(() => toDateOnly());
  const [endDate, setEndDate] = useState("");
  const fieldErrors = (getApiErrorDetails(error).fieldErrors ?? {}) as Record<string, string | undefined>;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const delegate = candidates.find((candidate) => candidate.id === delegateId);
    if (!delegate) return;
    if (!(await confirm({
      title: "Delegate Reviews",
      message: `${delegate.name} will be able to review the expenses that wait for you from ${formatDate(startDate)} to ${formatDate(endDate)}, on your behalf. You can still review them yourself.`,
      confirmLabel: "Delegate",
    }))) return;
    try {
      await createDelegation({ delegateId, startDate, endDate }).unwrap();
      setDelegateId("");
      setEndDate("");
      onDelegated(`Your reviews are delegated to ${delegate.name} from ${formatDate(startDate)} to ${formatDate(endDate)}.`);
    } catch {
      // The reason is shown with the form.
    }
  };

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    reset();
  };

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit} noValidate>
      {error && !getApiErrorDetails(error).fieldErrors && <ApiFeedback error={error} />}
      <TextField
        select
        label="Delegate"
        value={delegateId}
        onChange={(event) => change(setDelegateId)(event.target.value)}
        error={Boolean(fieldErrors.delegateId)}
        helperText={fieldErrors.delegateId ?? "Another manager or Finance user who reviews expenses."}
        sx={{ maxWidth: 480 }}
        required
      >
        {candidates.map((candidate) => (
          <MenuItem key={candidate.id} value={candidate.id}>
            {candidate.name} · {humanize(candidate.role)}, {candidate.teamName}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 480 }}>
        <TextField
          label="Start date"
          type="date"
          value={startDate}
          onChange={(event) => change(setStartDate)(event.target.value)}
          error={Boolean(fieldErrors.startDate)}
          helperText={fieldErrors.startDate}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: toDateOnly() } }}
          fullWidth
          required
        />
        <TextField
          label="End date"
          type="date"
          value={endDate}
          onChange={(event) => change(setEndDate)(event.target.value)}
          error={Boolean(fieldErrors.endDate)}
          helperText={fieldErrors.endDate ?? `At most ${MAX_DELEGATION_DAYS} days, both dates included.`}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: startDate } }}
          fullWidth
          required
        />
      </Stack>
      <Box>
        <Button type="submit" variant="contained" disabled={isLoading || !delegateId || !startDate || !endDate}>
          {isLoading ? "Delegating…" : "Delegate Reviews"}
        </Button>
      </Box>
    </Stack>
  );
}
