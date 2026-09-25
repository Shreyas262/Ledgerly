import { Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useCreateBudgetMutation } from "../api/budgetsApi";
import { BudgetForm } from "../components/BudgetForm";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import type { CreateOrganizationBudgetRequest } from "../types/budget";

export function CreateBudgetPage() {
  const navigate = useNavigate();
  const [createBudget, { isLoading, error }] = useCreateBudgetMutation();
  const handleSubmit = async (data: CreateOrganizationBudgetRequest) => {
    try {
      const created = await createBudget(data).unwrap();
      navigate(`/budgets/${created.id}`);
    } catch {
      // Error is exposed through the mutation state; form input is preserved.
    }
  };
  return <Stack spacing={3}><Stack spacing={0.5}><Typography variant="h4">Create Organization Budget</Typography><Typography color="text.secondary">Create the top-level budget before allocating it to departments.</Typography></Stack>{error && <ApiFeedback error={error} />}<BudgetForm onSubmit={handleSubmit} isSubmitting={isLoading} onCancel={() => navigate("/budgets")} /></Stack>;
}
