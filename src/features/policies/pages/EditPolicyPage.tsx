import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Stack,
} from "@mui/material";

import PolicyForm from "../components/PolicyForm";
import {
  useGetPolicyByIdQuery,
  useUpdatePolicyMutation,
} from "../api/policiesApi";
import type { CreateExpensePolicyRequest } from "../types/policy";
import {LoadingState} from "../../../components/common/LoadingState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import {ErrorState} from "../../../components/common/ErrorState";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";

export function EditPolicyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();

  const {
    data: policy,
    isLoading: isPolicyLoading,
    isError: isPolicyError,
    error: policyError,
    refetch: refetchPolicy,
  } = useGetPolicyByIdQuery(id ?? "", {
    skip: !id,
  });

  const [
    updatePolicy,
    {
      isLoading: isUpdating,
      error: updateError,
    },
  ] = useUpdatePolicyMutation();

  if (isPolicyLoading) {
    return <LoadingState />;
  }

  if (isPolicyError) {
    return <ErrorState error={policyError} onRetry={refetchPolicy} />;
  }

  if (!policy) {
    return <Alert severity="warning">Policy not found.</Alert>;
  }

  const initialValues: CreateExpensePolicyRequest = {
    name: policy.name,
    description: policy.description,
    expenseType: policy.expenseType,
    departmentIds: policy.departmentIds ?? [],
    rules: policy.rules,
    status: policy.status,
  };

  const handleSubmit = async (
    values: CreateExpensePolicyRequest,
  ) => {
    if (!(await confirm({ title: "Save Policy", message: `Save changes to "${values.name}"? New evaluations use the updated rules.`, confirmLabel: "Save" }))) return;
    try {
      const updatedPolicy = await updatePolicy({
        id: policy.id,
        ...values,
      }).unwrap();

      navigate(`/policies/${updatedPolicy.id}`);
    } catch {
      // Error state is displayed below.
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to={`/policies/${id}`} label="Policy" />
      <PageHeader
        title="Edit Policy"
        description="New checks use the updated rules; expenses already submitted keep the result they were checked with."
      />

      {updateError && <ApiFeedback error={updateError} />}

      <PolicyForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isSubmitting={isUpdating}
      />
    </Stack>
  );
}