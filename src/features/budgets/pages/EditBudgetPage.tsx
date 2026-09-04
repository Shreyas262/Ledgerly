import {
  Stack,
  Typography,
} from "@mui/material";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  useGetBudgetByIdQuery,
  useUpdateBudgetMutation,
} from "../api/budgetsApi";
import { BudgetForm } from "../components/BudgetForm";
import type { CreateBudgetRequest } from "../../../types/budget";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

export function EditBudgetPage() {
  const navigate = useNavigate();

  const { id } =
    useParams<{ id: string }>();

  const {
    data: budget,
    isLoading: isFetching,
    isError,
  } = useGetBudgetByIdQuery(id ?? "", {
    skip: !id,
  });

  const [
    updateBudget,
    { isLoading: isUpdating },
  ] = useUpdateBudgetMutation();

  const handleSubmit = async (
    data: CreateBudgetRequest,
  ) => {
    if (!id) {
      return;
    }

    try {
      await updateBudget({
        id,
        ...data,
      }).unwrap();

      navigate(`/budgets/${id}`);
    } catch {
      // The API error can be surfaced through
      // a shared mutation error state later.
    }
  };

  if (isFetching) {
    return <LoadingState />;
  }

  if (isError || !budget) {
    return <ErrorState />;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">
          Edit Budget
        </Typography>

        <Typography
          color="text.secondary"
        >
          Update the budget configuration.
        </Typography>
      </Stack>

      <BudgetForm
        budget={budget}
        onSubmit={handleSubmit}
        isSubmitting={isUpdating}
        onCancel={() =>
          navigate(`/budgets/${id}`)
        }
      />
    </Stack>
  );
}