import { useConfirm } from "../../../components/common/ConfirmProvider";
import { Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useCreateBudgetMutation } from "../api/budgetsApi";
import { BudgetForm } from "../components/BudgetForm";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import type { CreateOrganizationBudgetRequest } from "../types/budget";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";

export function CreateBudgetPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [createBudget, { isLoading, error }] = useCreateBudgetMutation();
  const handleSubmit = async (data: CreateOrganizationBudgetRequest) => {
    if (!(await confirm({ title: "Create Budget", message: `Create "${data.name}" (₹${data.amount.toLocaleString("en-IN")}) as a draft?`, confirmLabel: "Create" }))) return;
    try {
      const created = await createBudget(data).unwrap();
      navigate(`/budgets/${created.id}`);
    } catch {
      // Error is exposed through the mutation state; form input is preserved.
    }
  };
  return <Stack spacing={3}><BackLink to="/budgets" label="Budgets" /><PageHeader title="Create Organization Budget" description="Create the top-level budget before allocating it to departments." />{error && <ApiFeedback error={error} />}<BudgetForm onSubmit={handleSubmit} isSubmitting={isLoading} onCancel={() => navigate("/budgets")} /></Stack>;
}
