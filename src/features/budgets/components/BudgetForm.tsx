import { Button, Stack, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import type { OrganizationBudget, CreateOrganizationBudgetRequest } from "../types/budget";

interface BudgetFormProps {
  budget?: OrganizationBudget;
  onSubmit: (data: CreateOrganizationBudgetRequest) => void;
  isSubmitting?: boolean;
  onCancel: () => void;
}

interface FormState { name: string; description: string; amount: string; startDate: string; endDate: string; }
const INITIAL_FORM: FormState = { name: "", description: "", amount: "", startDate: "", endDate: "" };

export function BudgetForm({ budget, onSubmit, isSubmitting = false, onCancel }: BudgetFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState("");
  useEffect(() => {
    setForm(budget ? { name: budget.name, description: budget.description ?? "", amount: String(budget.amount), startDate: budget.startDate, endDate: budget.endDate } : INITIAL_FORM);
  }, [budget]);
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.name.trim()) return setError("Budget name is required.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Budget amount must be greater than zero.");
    if (!form.startDate || !form.endDate || form.startDate > form.endDate) return setError("A valid budget period is required.");
    setError("");
    onSubmit({ name: form.name.trim(), description: form.description.trim() || undefined, amount, startDate: form.startDate, endDate: form.endDate });
  };
  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <TextField label="Organization budget name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required fullWidth />
      <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} multiline minRows={3} fullWidth />
      <TextField label="Organization budget amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required fullWidth slotProps={{ htmlInput: { min: 1 } }} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="End date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>
      {error && <TextField value={error} error helperText={error} slotProps={{ input: { readOnly: true } }} />}
      <Stack direction="row" spacing={2}>
        <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save budget"}</Button>
        <Button type="button" onClick={onCancel}>Cancel</Button>
      </Stack>
    </Stack>
  );
}
