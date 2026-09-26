import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { usePreviewPolicyMutation } from "../api/policiesApi";
import { useGetDepartmentsQuery } from "../../organizations/api/organizationApi";
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPES, type ExpenseType } from "../../expenses/types/expense";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { PolicyEvaluationPanel } from "./PolicyEvaluationPanel";

interface PolicySimulatorDialogProps {
  open: boolean;
  onClose: () => void;
}

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Tries the active policies against a hypothetical expense without creating one (§21.13). */
export function PolicySimulatorDialog({ open, onClose }: PolicySimulatorDialogProps) {
  const { data: departments = [] } = useGetDepartmentsQuery();
  const [preview, { data, error, isLoading, reset }] = usePreviewPolicyMutation();
  const [expenseType, setExpenseType] = useState<ExpenseType>("TRAVEL");
  const [amount, setAmount] = useState("5000");
  const [expenseDate, setExpenseDate] = useState(today);
  const [departmentId, setDepartmentId] = useState("");
  const [description, setDescription] = useState("");
  const [monthlySpent, setMonthlySpent] = useState("0");

  const selectedDepartment = departmentId || departments[0]?.id || "";

  const run = () =>
    void preview({
      expenseType,
      amount: Number(amount),
      expenseDate,
      departmentId: selectedDepartment,
      description,
      monthlySpent: Number(monthlySpent) || 0,
    });

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>Try a policy</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            See which active policy applies and what each rule would do. Nothing is saved, and a receipt is assumed to be attached.
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label="Expense type" value={expenseType} onChange={(event) => setExpenseType(event.target.value as ExpenseType)}>
                {EXPENSE_TYPES.map((type) => <MenuItem key={type} value={type}>{EXPENSE_TYPE_LABELS[type]}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select fullWidth label="Department" value={selectedDepartment} onChange={(event) => setDepartmentId(event.target.value)}>
                {departments.map((department) => <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth type="number" label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth type="date" label="Expense date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth type="number" label="Already spent this month" value={monthlySpent} onChange={(event) => setMonthlySpent(event.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
            </Grid>
          </Grid>
          {error && <ApiFeedback error={error} />}
          {data && (
            data.policy
              ? <PolicyEvaluationPanel evaluation={data.evaluation} title={`Result under "${data.policy.name}"`} />
              : <Alert severity="info">No active policy applies to this expense type and department. Only the receipt requirement would be checked.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} sx={{ minWidth: 100 }}>Close</Button>
        <Button variant="contained" onClick={run} disabled={isLoading || !selectedDepartment} sx={{ minWidth: 120 }}>
          {isLoading ? "Checking..." : "Check"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
