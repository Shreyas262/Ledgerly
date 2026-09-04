import {
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import {
  useCreateBudgetMutation,
} from "../api/budgetsApi";
import { BudgetForm } from "../components/BudgetForm";
import type { CreateBudgetRequest } from "../../../types/budget";

export function CreateBudgetPage() {
  const navigate = useNavigate();

  const [ createBudget, { isLoading },] = useCreateBudgetMutation();

  const handleSubmit = async (
    data: CreateBudgetRequest,
  ) => {
    try {
      const createdBudget = await createBudget(data).unwrap();

      navigate(
        `/budgets/${createdBudget.id}`,
      );
    } catch {
        
    }
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">
          Create Budget
        </Typography>

        <Typography
          color="text.secondary"
        >
          Create a spending budget for a department or project.
        </Typography>
      </Stack>

      <BudgetForm
        onSubmit={handleSubmit}
        isSubmitting={isLoading}
        onCancel={() => navigate("/budgets")}
      />
    </Stack>
  );
}