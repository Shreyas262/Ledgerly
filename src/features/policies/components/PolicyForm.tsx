import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type {
  CreateExpensePolicyRequest,
  PolicyStatus,
} from "../types/policy";
import { EXPENSE_TYPES, EXPENSE_TYPE_LABELS, type ExpenseType } from "../../expenses/types/expense";

interface PolicyFormProps {
  initialValues?: CreateExpensePolicyRequest;
  onSubmit: (values: CreateExpensePolicyRequest) => void;
  isSubmitting?: boolean;
}

const defaultValues: CreateExpensePolicyRequest = {
  name: "",
  description: "",
  approvalLimit: 50000,
  status: "active",
  rule: {
    approvalThreshold: 50000,
  },
};

function PolicyForm({
  initialValues = defaultValues,
  onSubmit,
  isSubmitting = false,
}: PolicyFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [description, setDescription] = useState(
    initialValues.description ?? "",
  );
  const [approvalLimit, setApprovalLimit] = useState(
    String(initialValues.approvalLimit),
  );
  const [status, setStatus] = useState<PolicyStatus>(initialValues.status);
  const [expenseType, setExpenseType] = useState<ExpenseType | "ALL">(
    initialValues.expenseType ?? "ALL",
  );
  const [approvalThreshold, setApprovalThreshold] = useState(
    String(initialValues.rule?.approvalThreshold ?? initialValues.approvalLimit),
  );
  const [maximumAmount, setMaximumAmount] = useState(
    initialValues.rule?.maximumAmount === undefined
      ? ""
      : String(initialValues.rule.maximumAmount),
  );
  const [requiresReceipt, setRequiresReceipt] = useState(
    Boolean(initialValues.rule?.requiresReceipt),
  );

  const [errors, setErrors] = useState({
    name: "",
    approvalLimit: "",
    approvalThreshold: "",
    maximumAmount: "",
  });

  useEffect(() => {
    setName(initialValues.name);
    setDescription(initialValues.description ?? "");
    setApprovalLimit(String(initialValues.approvalLimit));
    setStatus(initialValues.status);
    setExpenseType(initialValues.expenseType ?? "ALL");
    setApprovalThreshold(
      String(
        initialValues.rule?.approvalThreshold ?? initialValues.approvalLimit,
      ),
    );
    setMaximumAmount(
      initialValues.rule?.maximumAmount === undefined
        ? ""
        : String(initialValues.rule.maximumAmount),
    );
    setRequiresReceipt(Boolean(initialValues.rule?.requiresReceipt));
  }, [initialValues]);

  const validate = () => {
    const nextErrors = {
      name: "",
      approvalLimit: "",
      approvalThreshold: "",
      maximumAmount: "",
    };

    if (!name.trim()) {
      nextErrors.name = "Policy name is required.";
    }

    const numericLimit = Number(approvalLimit);

    if (!approvalLimit || Number.isNaN(numericLimit)) {
      nextErrors.approvalLimit = "Approval limit is required.";
    } else if (numericLimit <= 0) {
      nextErrors.approvalLimit = "Approval limit must be greater than 0.";
    }

    const numericThreshold = Number(approvalThreshold);
    if (!approvalThreshold || Number.isNaN(numericThreshold) || numericThreshold <= 0) {
      nextErrors.approvalThreshold = "Approval threshold must be greater than 0.";
    }

    if (maximumAmount) {
      const numericMaximum = Number(maximumAmount);
      if (Number.isNaN(numericMaximum) || numericMaximum <= 0) {
        nextErrors.maximumAmount = "Maximum amount must be greater than 0.";
      } else if (numericMaximum < numericThreshold) {
        nextErrors.maximumAmount =
          "Maximum amount must be greater than or equal to the approval threshold.";
      }
    }

    setErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      approvalLimit: Number(approvalLimit),
      expenseType: expenseType === "ALL" ? undefined : expenseType,
      rule: {
        approvalThreshold: Number(approvalThreshold),
        ...(maximumAmount
          ? { maximumAmount: Number(maximumAmount) }
          : {}),
        requiresReceipt,
      },
      status,
    });
  };

  return (
    <Card>
      <CardContent>
        <Stack
          component="form"
          onSubmit={handleSubmit}
          spacing={3}
        >
          <TextField
            label="Policy Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={Boolean(errors.name)}
            helperText={errors.name}
            fullWidth
            required
          />

          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={3}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="policy-expense-type-label">Expense Type</InputLabel>
            <Select
              labelId="policy-expense-type-label"
              value={expenseType}
              label="Expense Type"
              onChange={(event) =>
                setExpenseType(event.target.value as ExpenseType | "ALL")
              }
            >
              <MenuItem value="ALL">All Expense Types</MenuItem>
              {EXPENSE_TYPES.map((value) => (
                <MenuItem key={value} value={value}>
                  {EXPENSE_TYPE_LABELS[value]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Approval Limit"
            type="number"
            value={approvalLimit}
            onChange={(event) => setApprovalLimit(event.target.value)}
            error={Boolean(errors.approvalLimit)}
            helperText={
              errors.approvalLimit || "Amount is in INR."
            }
            slotProps={{
                htmlInput: { min: 1 },
            }}
            fullWidth
            required
          />

          <TextField
            label="Approval Threshold"
            type="number"
            value={approvalThreshold}
            onChange={(event) => setApprovalThreshold(event.target.value)}
            error={Boolean(errors.approvalThreshold)}
            helperText={
              errors.approvalThreshold ||
              "Amounts above this threshold require approval."
            }
            slotProps={{ htmlInput: { min: 1 } }}
            fullWidth
            required
          />

          <TextField
            label="Maximum Amount"
            type="number"
            value={maximumAmount}
            onChange={(event) => setMaximumAmount(event.target.value)}
            error={Boolean(errors.maximumAmount)}
            helperText={
              errors.maximumAmount ||
              "Optional hard limit. Amounts above it violate the policy."
            }
            slotProps={{ htmlInput: { min: 1 } }}
            fullWidth
          />

          <FormControl>
            <Stack sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={requiresReceipt}
                onChange={(event) => setRequiresReceipt(event.target.checked)}
              />
              <Typography variant="body2">Receipt required</Typography>
            </Stack>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="policy-status-label">
              Status
            </InputLabel>

            <Select
              labelId="policy-status-label"
              value={status}
              label="Status"
              onChange={(event) =>
                setStatus(event.target.value as PolicyStatus)
              }
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>

            <FormHelperText>
              Inactive policies are not used for new expense evaluations.
            </FormHelperText>
          </FormControl>

          <Button
            type="submit"
            variant="contained"
            loading={isSubmitting}
          >
            Save Policy
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default PolicyForm;