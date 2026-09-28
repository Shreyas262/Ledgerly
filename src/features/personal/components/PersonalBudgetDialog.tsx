import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlineOutlined } from "@mui/icons-material";

import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { formatCurrency } from "../../../utils/currency";
import { useCreatePersonalBudgetMutation, useUpdatePersonalBudgetMutation } from "../api/personalApi";
import {
  PERSONAL_EXPENSE_TYPES,
  PERSONAL_EXPENSE_TYPE_LABELS,
  type PersonalBudget,
  type PersonalExpenseType,
} from "../types/personal";
import { currentMonth, formatMonth } from "../utils/personalFormat";

interface LimitRow {
  key: number;
  type: PersonalExpenseType | "";
  amount: string;
}

interface Errors {
  month?: string;
  amount?: string;
  typeLimits?: string;
}

interface PersonalBudgetDialogProps {
  open: boolean;
  /** The budget to edit; omitted to create one. */
  budget?: PersonalBudget;
  /** Month preselected when creating. */
  defaultMonth?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function PersonalBudgetDialog(props: PersonalBudgetDialogProps) {
  // Remount per open so the form always starts from the current budget.
  return props.open ? <BudgetForm {...props} /> : null;
}

function BudgetForm({ budget, defaultMonth, onClose, onSaved }: PersonalBudgetDialogProps) {
  const confirm = useConfirm();
  const [month, setMonth] = useState(budget?.month ?? defaultMonth ?? currentMonth());
  const [amount, setAmount] = useState(budget ? String(budget.amount) : "");
  const [limits, setLimits] = useState<LimitRow[]>(
    () => budget?.typeLimits.map((limit, index) => ({ key: index, type: limit.type, amount: String(limit.amount) })) ?? [],
  );
  const [errors, setErrors] = useState<Errors>({});
  const [createBudget, { isLoading: isCreating, error: createError }] = useCreatePersonalBudgetMutation();
  const [updateBudget, { isLoading: isUpdating, error: updateError }] = useUpdatePersonalBudgetMutation();
  const saveError = createError ?? updateError;
  const serverErrors = getApiErrorDetails(saveError).fieldErrors ?? {};
  const fieldError = (field: keyof Errors) => errors[field] ?? serverErrors[field]?.toString();
  const isSaving = isCreating || isUpdating;

  const usedTypes = new Set(limits.map((limit) => limit.type));
  const limitsTotal = limits.reduce((total, limit) => total + (Number(limit.amount) || 0), 0);

  const updateLimit = (key: number, changes: Partial<LimitRow>) => {
    setLimits((current) => current.map((limit) => (limit.key === key ? { ...limit, ...changes } : limit)));
    setErrors((current) => ({ ...current, typeLimits: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    const total = Number(amount);
    if (!/^\d{4}-\d{2}$/.test(month)) next.month = "Choose a month.";
    if (!amount.trim() || !Number.isFinite(total) || total <= 0) next.amount = "Enter a budget greater than zero.";
    if (limits.some((limit) => !limit.type)) next.typeLimits = "Choose a type for each limit.";
    else if (limits.some((limit) => !(Number(limit.amount) > 0))) next.typeLimits = "Each limit must be greater than zero.";
    else if (!next.amount && limitsTotal > total) next.typeLimits = "Type limits cannot add up to more than the monthly budget.";
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = {
      month,
      amount: Number(amount),
      typeLimits: limits.map((limit) => ({ type: limit.type as PersonalExpenseType, amount: Number(limit.amount) })),
    };
    if (!(await confirm({
      title: budget ? "Save Budget" : "Create Budget",
      message: `${budget ? "Save" : "Create"} a ${formatCurrency(body.amount)} budget for ${formatMonth(month)}?`,
      confirmLabel: budget ? "Save" : "Create",
    }))) return;

    try {
      if (budget) {
        await updateBudget({ id: budget.id, ...body }).unwrap();
        onSaved(`The budget for ${formatMonth(month)} has been saved.`);
      } else {
        await createBudget(body).unwrap();
        onSaved(`The budget for ${formatMonth(month)} has been created.`);
      }
    } catch {
      // The reason is shown in the dialog.
    }
  };

  return (
    <Dialog open onClose={isSaving ? undefined : onClose} maxWidth="sm" fullWidth>
      <Stack component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>{budget ? "Edit Budget" : "Create Monthly Budget"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {saveError && !Object.keys(serverErrors).length && <ApiFeedback error={saveError} />}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="month"
                label="Month"
                value={month}
                onChange={(event) => { setMonth(event.target.value); setErrors((current) => ({ ...current, month: undefined })); }}
                error={Boolean(fieldError("month"))}
                helperText={fieldError("month")}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                type="number"
                label="Monthly budget"
                value={amount}
                onChange={(event) => { setAmount(event.target.value); setErrors((current) => ({ ...current, amount: undefined })); }}
                error={Boolean(fieldError("amount"))}
                helperText={fieldError("amount")}
                required
                fullWidth
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                  htmlInput: { min: 0, step: "1", inputMode: "decimal" },
                }}
              />
            </Stack>

            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle2">Limits by type (optional)</Typography>
                <Typography variant="body2" color="text.secondary">
                  Cap spending on specific types within this budget.
                  {limits.length > 0 && ` ${formatCurrency(limitsTotal)} of ${formatCurrency(Number(amount) || 0)} assigned.`}
                </Typography>
              </Stack>
              {limits.map((limit) => (
                <Stack key={limit.key} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <TextField
                    select
                    size="small"
                    label="Type"
                    value={limit.type}
                    onChange={(event) => updateLimit(limit.key, { type: event.target.value as PersonalExpenseType })}
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {PERSONAL_EXPENSE_TYPES.map((type) => (
                      <MenuItem key={type} value={type} disabled={type !== limit.type && usedTypes.has(type)}>
                        {PERSONAL_EXPENSE_TYPE_LABELS[type]}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    type="number"
                    label="Limit"
                    value={limit.amount}
                    onChange={(event) => updateLimit(limit.key, { amount: event.target.value })}
                    sx={{ width: { xs: 120, sm: 160 } }}
                    slotProps={{ htmlInput: { min: 0, step: "1", inputMode: "decimal" } }}
                  />
                  <IconButton
                    aria-label="Remove limit"
                    onClick={() => setLimits((current) => current.filter((item) => item.key !== limit.key))}
                  >
                    <DeleteOutlineOutlined />
                  </IconButton>
                </Stack>
              ))}
              {fieldError("typeLimits") && <Alert severity="warning">{fieldError("typeLimits")}</Alert>}
              <Button
                startIcon={<AddOutlined />}
                onClick={() => setLimits((current) => [...current, { key: Date.now(), type: "", amount: "" }])}
                disabled={limits.length >= PERSONAL_EXPENSE_TYPES.length}
                sx={{ alignSelf: "flex-start" }}
              >
                Add type limit
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" variant="contained" loading={isSaving}>
            {budget ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Stack>
    </Dialog>
  );
}
