import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  Alert,
  Button,
  Chip,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AttachFileOutlined } from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { formatCurrency } from "../../../utils/currency";
import {
  useCreatePersonalExpenseMutation,
  useGetPersonalExpenseQuery,
  useUpdatePersonalExpenseMutation,
  useUploadPersonalDocumentMutation,
} from "../api/personalApi";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PERSONAL_EXPENSE_TYPES,
  PERSONAL_EXPENSE_TYPE_LABELS,
  type PaymentMethod,
  type PersonalExpense,
  type PersonalExpenseType,
} from "../types/personal";
import { todayDate } from "../utils/personalFormat";
import { RECEIPT_ACCEPT, validateReceiptFile } from "../utils/receiptFiles";

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_RECEIPTS = 5;

interface FormState {
  amount: string;
  expenseDate: string;
  type: PersonalExpenseType;
  paymentMethod: PaymentMethod;
  description: string;
}

type FieldErrors = Partial<Record<keyof FormState | "receipts", string>>;

const toFormState = (expense?: PersonalExpense): FormState => ({
  amount: expense ? String(expense.amount) : "",
  expenseDate: expense?.expenseDate ?? todayDate(),
  type: expense?.type ?? "GROCERIES",
  paymentMethod: expense?.paymentMethod ?? "UPI",
  description: expense?.description ?? "",
});

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const amount = Number(form.amount);
  if (!form.amount.trim() || !Number.isFinite(amount) || amount <= 0) errors.amount = "Enter an amount greater than zero.";
  if (!form.expenseDate) errors.expenseDate = "Enter a date.";
  else if (form.expenseDate > todayDate()) errors.expenseDate = "The date cannot be in the future.";
  if (!form.description.trim()) errors.description = "Description is required.";
  else if (form.description.trim().length > MAX_DESCRIPTION_LENGTH) errors.description = `Use at most ${MAX_DESCRIPTION_LENGTH} characters.`;
  return errors;
}

interface PersonalExpenseFormPageProps {
  mode: "create" | "edit";
}

export function PersonalExpenseFormPage({ mode }: PersonalExpenseFormPageProps) {
  const { id = "" } = useParams();
  const isEdit = mode === "edit";
  const { data: expense, isLoading, isError, error, refetch } = useGetPersonalExpenseQuery(id, { skip: !isEdit });

  if (isEdit && isLoading) return <LoadingState message="Loading expense…" />;
  if (isEdit && (isError || !expense)) {
    return (
      <Stack spacing={3}>
        <BackLink to="/personal/expenses" label="Expenses" />
        <ErrorState error={error} onRetry={refetch} />
      </Stack>
    );
  }

  // Keyed so the form starts from the loaded expense.
  return <ExpenseForm key={expense?.id ?? "new"} expense={isEdit ? expense : undefined} />;
}

function ExpenseForm({ expense }: { expense?: PersonalExpense }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const isEdit = Boolean(expense);
  const [form, setForm] = useState<FormState>(() => toFormState(expense));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [receipts, setReceipts] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [createExpense, { isLoading: isCreating, error: createError }] = useCreatePersonalExpenseMutation();
  const [updateExpense, { isLoading: isUpdating, error: updateError }] = useUpdatePersonalExpenseMutation();
  const [uploadDocument, { isLoading: isUploading }] = useUploadPersonalDocumentMutation();
  const saveError = createError ?? updateError;
  const serverErrors = getApiErrorDetails(saveError).fieldErrors ?? {};
  const fieldError = (field: keyof FieldErrors) => errors[field] ?? serverErrors[field]?.toString();
  const isSaving = isCreating || isUpdating || isUploading;
  const backTo = expense ? `/personal/expenses/${expense.id}` : "/personal/expenses";

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleReceipts = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setFileInputKey((current) => current + 1);
    const invalid = files.map(validateReceiptFile).find(Boolean);
    if (invalid) {
      setErrors((current) => ({ ...current, receipts: invalid }));
      return;
    }
    const next = [...receipts, ...files.filter((file) => !receipts.some((item) => item.name === file.name))];
    if (next.length > MAX_RECEIPTS) {
      setErrors((current) => ({ ...current, receipts: `Attach at most ${MAX_RECEIPTS} files.` }));
      return;
    }
    setErrors((current) => ({ ...current, receipts: undefined }));
    setReceipts(next);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const amount = Number(form.amount);
    const body = {
      type: form.type,
      paymentMethod: form.paymentMethod,
      amount,
      expenseDate: form.expenseDate,
      description: form.description.trim(),
    };

    if (!(await confirm({
      title: isEdit ? "Save Changes" : "Add Expense",
      message: isEdit
        ? `Save changes to "${body.description}"?`
        : `Add "${body.description}" for ${formatCurrency(amount)}${receipts.length ? ` with ${receipts.length} ${receipts.length === 1 ? "receipt" : "receipts"}` : ""}?`,
      confirmLabel: isEdit ? "Save" : "Add Expense",
    }))) return;

    try {
      if (expense) {
        await updateExpense({ id: expense.id, ...body }).unwrap();
        navigate(`/personal/expenses/${expense.id}`, { state: { notice: "Your changes have been saved." } });
        return;
      }

      const created = await createExpense(body).unwrap();
      // Receipts are optional; the expense is kept even if one fails to upload.
      const failed: string[] = [];
      for (const file of receipts) {
        try {
          await uploadDocument({ expenseId: created.id, file }).unwrap();
        } catch {
          failed.push(file.name);
        }
      }
      navigate(`/personal/expenses/${created.id}`, {
        replace: true,
        state: failed.length
          ? { receiptError: `The expense was added, but ${failed.join(", ")} could not be attached. You can try again below.` }
          : { notice: "Expense added." },
      });
    } catch {
      // The form keeps its input; the reason is shown above the fields.
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to={backTo} label={isEdit ? "Expense" : "Expenses"} />
      <PageHeader
        title={isEdit ? "Edit Expense" : "Add Expense"}
        description={isEdit ? "Update the details of this expense." : "Record something you spent money on."}
      />

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate>
          {saveError && !Object.keys(serverErrors).length && <ApiFeedback error={saveError} />}

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Amount"
                type="number"
                value={form.amount}
                onChange={(event) => setField("amount", event.target.value)}
                error={Boolean(fieldError("amount"))}
                helperText={fieldError("amount")}
                required
                fullWidth
                autoFocus={!isEdit}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                  htmlInput: { min: 0, step: "0.01", inputMode: "decimal" },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Date"
                type="date"
                value={form.expenseDate}
                onChange={(event) => setField("expenseDate", event.target.value)}
                error={Boolean(fieldError("expenseDate"))}
                helperText={fieldError("expenseDate")}
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayDate() } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Type"
                value={form.type}
                onChange={(event) => setField("type", event.target.value as PersonalExpenseType)}
                error={Boolean(fieldError("type"))}
                helperText={fieldError("type")}
                required
                fullWidth
              >
                {PERSONAL_EXPENSE_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{PERSONAL_EXPENSE_TYPE_LABELS[type]}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Payment method"
                value={form.paymentMethod}
                onChange={(event) => setField("paymentMethod", event.target.value as PaymentMethod)}
                error={Boolean(fieldError("paymentMethod"))}
                helperText={fieldError("paymentMethod")}
                required
                fullWidth
              >
                {PAYMENT_METHODS.map((method) => (
                  <MenuItem key={method} value={method}>{PAYMENT_METHOD_LABELS[method]}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField
                label="Description"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                error={Boolean(fieldError("description"))}
                helperText={fieldError("description") ?? `${form.description.trim().length}/${MAX_DESCRIPTION_LENGTH}`}
                placeholder="e.g. Weekly groceries"
                multiline
                minRows={2}
                required
                fullWidth
              />
            </Grid>
          </Grid>

          {isEdit ? (
            <Typography variant="body2" color="text.secondary">
              Receipts and documents are managed on the expense's page.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle2">Receipts (optional)</Typography>
                <Typography variant="body2" color="text.secondary">
                  JPG, PNG or PDF up to 5 MB each. You can also add them later.
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                <Button component="label" variant="outlined" startIcon={<AttachFileOutlined />} disabled={isSaving}>
                  Attach files
                  <input key={fileInputKey} hidden type="file" multiple accept={RECEIPT_ACCEPT} onChange={handleReceipts} />
                </Button>
                {receipts.map((file) => (
                  <Chip
                    key={file.name}
                    label={file.name}
                    onDelete={isSaving ? undefined : () => setReceipts((current) => current.filter((item) => item !== file))}
                    sx={{ maxWidth: 260 }}
                  />
                ))}
              </Stack>
              {fieldError("receipts") && <Alert severity="warning">{fieldError("receipts")}</Alert>}
            </Stack>
          )}

          <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1.5} sx={{ justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={() => navigate(backTo)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" loading={isSaving}>
              {isEdit ? "Save Changes" : "Add Expense"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
