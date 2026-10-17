import { useRef, useState, type FormEvent } from "react";
import { Alert, Button, Paper, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { ExpensePolicyPreview } from "../../policies/components/ExpensePolicyPreview";
import { useGetActiveBudgetPeriodQuery } from "../../budgets/api/budgetsApi";
import { useUploadDocumentMutation } from "../../documents/api/documentApi";
import { ReceiptAttachmentField } from "../../documents/components/ReceiptAttachmentField";
import type { ReceiptDetails } from "../../documents/utils/parseReceiptText";
import { applyReceiptDetails, describeReceiptFill, type ReceiptFieldMap } from "../../documents/utils/receiptFill";
import { useCreateExpenseMutation } from "../api/expenseApi";
import { ExpenseFormFields } from "../components/ExpenseFormFields";
import { EMPTY_EXPENSE_FORM, isExpenseFormComplete, toExpenseRequest, type ExpenseFormData } from "../utils/expenseForm";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { formatCurrency } from "../../../utils/currency";
import { formatDate } from "../../../utils/format";

const RECEIPT_FIELDS: ReceiptFieldMap<ExpenseFormData> = {
  amount: { field: "amount", label: "amount" },
  date: { field: "expenseDate", label: "expense date" },
  merchant: { field: "title", label: "title" },
};

export function CreateExpensePage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [formData, setFormData] = useState<ExpenseFormData>(EMPTY_EXPENSE_FORM);
  const [receipts, setReceipts] = useState<File[]>([]);
  const [receiptNotice, setReceiptNotice] = useState<string | null>(null);
  // Fields the user has typed in are never overwritten by a receipt.
  const editedFields = useRef(new Set<keyof ExpenseFormData>());

  const [createExpense, { isLoading: isCreating, error }] = useCreateExpenseMutation();
  const [uploadDocument, { isLoading: isUploading }] = useUploadDocumentMutation();
  const { data: eligibility } = useGetActiveBudgetPeriodQuery(undefined, { refetchOnMountOrArgChange: true });
  const activePeriod = eligibility?.period;
  const creationBlocked = eligibility ? !eligibility.canCreateExpense : false;
  const details = getApiErrorDetails(error);
  const isSaving = isCreating || isUploading;

  const handleChange = (next: ExpenseFormData) => {
    for (const field of Object.keys(next) as (keyof ExpenseFormData)[]) {
      if (next[field] !== formData[field]) editedFields.current.add(field);
    }
    setFormData(next);
  };

  const handleReceiptRead = (receipt: ReceiptDetails, file: File) => {
    setFormData((current) => applyReceiptDetails(current, receipt, RECEIPT_FIELDS, editedFields.current).form);
    // Which fields are filled depends only on the receipt and the edited fields, not on current values.
    setReceiptNotice(describeReceiptFill(file.name, applyReceiptDetails(formData, receipt, RECEIPT_FIELDS, editedFields.current)));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isExpenseFormComplete(formData)) {
      return;
    }

    const request = toExpenseRequest(formData);
    const withReceipts = receipts.length ? ` with ${receipts.length} ${receipts.length === 1 ? "receipt" : "receipts"}` : "";
    if (!(await confirm({ title: "Create Expense", message: `Create "${request.title}" for ${formatCurrency(request.amount)}${withReceipts} as a draft?`, confirmLabel: "Create" }))) return;

    let createdId: string;
    try {
      createdId = (await createExpense(request).unwrap()).id;
    } catch {
      // Preserve form input so the user can correct or retry after a server failure.
      return;
    }

    // The draft is kept even if a receipt fails to upload; it can be added on the expense's page.
    const failed: string[] = [];
    for (const file of receipts) {
      try {
        await uploadDocument({ expenseId: createdId, file }).unwrap();
      } catch {
        failed.push(file.name);
      }
    }
    navigate(`/expenses/${createdId}`, {
      state: failed.length
        ? { receiptError: `The expense was created, but ${failed.join(", ")} could not be attached. You can add ${failed.length === 1 ? "it" : "them"} below.` }
        : undefined,
    });
  };

  return (
    <Stack spacing={3}>
      <BackLink to="/expenses" label="Expenses" />

      <PageHeader title="Create Expense" />

      {creationBlocked && (
        <Alert severity="warning">
          {eligibility?.reason}
        </Alert>
      )}
      {activePeriod && (
        <Alert severity="info">
          The expense date must fall within the active budget period ({formatDate(activePeriod.startDate)} to {formatDate(activePeriod.endDate)}).
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          {error && <ApiFeedback error={error} />}

          <ReceiptAttachmentField
            files={receipts}
            onFilesChange={setReceipts}
            onRead={handleReceiptRead}
            disabled={isSaving || creationBlocked}
          />

          {receiptNotice && (
            <Alert severity="info" onClose={() => setReceiptNotice(null)}>
              {receiptNotice}
            </Alert>
          )}

          <ExpenseFormFields
            value={formData}
            onChange={handleChange}
            fieldErrors={details.fieldErrors}
            dateRange={activePeriod ? { min: activePeriod.startDate, max: activePeriod.endDate } : undefined}
          />

          <ExpensePolicyPreview
            type={formData.type}
            amount={formData.amount}
            expenseDate={formData.expenseDate}
            description={formData.description}
          />

          <Stack
            direction="row"
            sx={{ justifyContent: "flex-end" }}
            spacing={2}
          >
            <Button
              variant="outlined"
              onClick={() => navigate("/expenses")}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button type="submit" variant="contained" loading={isSaving} disabled={creationBlocked}>
              Create Expense
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
