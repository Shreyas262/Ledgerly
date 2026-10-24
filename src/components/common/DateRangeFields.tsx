import { useId, useState } from "react";
import { TextField } from "@mui/material";

export interface DateRangeValue {
  /** "YYYY-MM-DD", or "" for an open start. */
  from: string;
  /** "YYYY-MM-DD", or "" for an open end. */
  to: string;
}

interface DateRangeFieldsProps {
  value: DateRangeValue;
  /** Called only with complete ranges whose start is on or before the end. */
  onChange: (value: DateRangeValue) => void;
  fromLabel?: string;
  toLabel?: string;
  /** Both dates must be given (e.g. a custom analytics range). */
  required?: boolean;
}

// Native date inputs report years such as 0002 while a year is being typed.
const MIN_YEAR = 1900;

const isCompleteDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && Number(date.slice(0, 4)) >= MIN_YEAR;

const isUsable = (date: string, required: boolean) => (date === "" ? !required : isCompleteDate(date));

/**
 * From/To date fields for filters. Edits stay local until they form a valid
 * range, so the page never queries a half-typed date or an inverted range and
 * the fields stay usable while the user corrects them.
 */
export function DateRangeFields({ value, onChange, fromLabel = "From", toLabel = "To", required = false }: DateRangeFieldsProps) {
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [touched, setTouched] = useState({ from: false, to: false });
  const fromId = useId();
  const toId = useId();

  // A new value from the page (a reset, a preset, or the range just passed on) replaces the draft.
  if (value.from !== previousValue.from || value.to !== previousValue.to) {
    setPreviousValue(value);
    setDraft(value);
    setTouched({ from: false, to: false });
  }

  const inverted = isCompleteDate(draft.from) && isCompleteDate(draft.to) && draft.from > draft.to;
  const fieldError = (field: keyof DateRangeValue) =>
    touched[field] && !isUsable(draft[field], required)
      ? draft[field] === "" ? "Enter a date." : "Enter a valid date."
      : null;
  const fromError = fieldError("from");
  const toError = inverted ? "The end date must be on or after the start date." : fieldError("to");

  const update = (field: keyof DateRangeValue, date: string) => {
    const next = { ...draft, [field]: date };
    setDraft(next);
    const valid = isUsable(next.from, required) && isUsable(next.to, required) && !(next.from && next.to && next.from > next.to);
    if (valid && (next.from !== value.from || next.to !== value.to)) onChange(next);
  };

  const markTouched = (field: keyof DateRangeValue) => setTouched((current) => ({ ...current, [field]: true }));

  return (
    <>
      <TextField
        id={fromId}
        size="small"
        type="date"
        label={fromLabel}
        value={draft.from}
        onChange={(event) => update("from", event.target.value)}
        onBlur={() => markTouched("from")}
        error={Boolean(fromError) || inverted}
        helperText={fromError}
        required={required}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: {
            max: isCompleteDate(draft.to) ? draft.to : undefined,
            // The order message sits under the end date; announce it from both fields.
            ...(inverted && !fromError ? { "aria-describedby": `${toId}-helper-text` } : {}),
          },
        }}
      />
      <TextField
        id={toId}
        size="small"
        type="date"
        label={toLabel}
        value={draft.to}
        onChange={(event) => update("to", event.target.value)}
        onBlur={() => markTouched("to")}
        error={Boolean(toError)}
        helperText={toError}
        required={required}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: isCompleteDate(draft.from) ? draft.from : undefined } }}
      />
    </>
  );
}
