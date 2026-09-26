import { useConfirm } from "../../../components/common/ConfirmProvider";
import { Stack } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { useGetBudgetByIdQuery, useUpdateBudgetMutation } from "../api/budgetsApi";
import { BudgetForm } from "../components/BudgetForm";
import type { CreateOrganizationBudgetRequest } from "../types/budget";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";

export function EditBudgetPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error: loadError, refetch } = useGetBudgetByIdQuery(id ?? "", { skip: !id });
  const [updateBudget, { isLoading: isUpdating, error: updateError }] = useUpdateBudgetMutation();
  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState error={loadError} onRetry={refetch} />;
  const handleSubmit = async (payload: CreateOrganizationBudgetRequest) => {
    if (!(await confirm({ title: "Save budget", message: `Save changes to "${payload.name}"?`, confirmLabel: "Save" }))) return;
    try {
      await updateBudget({ id: data.id, ...payload }).unwrap();
      navigate(`/budgets/${data.id}`);
    } catch {
      // Error is exposed through the mutation state; form input is preserved.
    }
  };
  return <Stack spacing={3}><BackLink to={`/budgets/${data.id}`} label="Budget" /><PageHeader title="Edit Organization Budget" description="Department allocations must remain within the organization budget." />{updateError && <ApiFeedback error={updateError} onReconcile={() => navigate(`/budgets/${data.id}`)} />}<BudgetForm budget={data} onSubmit={handleSubmit} isSubmitting={isUpdating} onCancel={() => navigate(`/budgets/${data.id}`)} /></Stack>;
}
