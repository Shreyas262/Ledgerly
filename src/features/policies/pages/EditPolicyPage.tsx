import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Stack,
  Typography,
} from "@mui/material";

import PolicyForm from "../components/PolicyForm";
import {
  useGetPolicyByIdQuery,
  useUpdatePolicyMutation,
} from "../api/policiesApi";
import type { CreateExpensePolicyRequest } from "../../../types/policy";
import {LoadingState} from "../../../components/common/LoadingState";
import {ErrorState} from "../../../components/common/ErrorState";

export function EditPolicyPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: policy,
    isLoading: isPolicyLoading,
    isError: isPolicyError,
  } = useGetPolicyByIdQuery(id ?? "", {
    skip: !id,
  });

  const [
    updatePolicy,
    {
      isLoading: isUpdating,
      isError: isUpdateError,
    },
  ] = useUpdatePolicyMutation();

  if (isPolicyLoading) {
    return <LoadingState />;
  }

  if (isPolicyError) {
    return <ErrorState message="Unable to load policy." />;
  }

  if (!policy) {
    return <Alert severity="warning">Policy not found.</Alert>;
  }

  const initialValues: CreateExpensePolicyRequest = {
    name: policy.name,
    description: policy.description,
    approvalLimit: policy.approvalLimit,
    status: policy.status,
  };

  const handleSubmit = async (
    values: CreateExpensePolicyRequest,
  ) => {
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
      <div>
        <Typography variant="h4">
          Edit Policy
        </Typography>

        <Typography color="text.secondary">
          Update the expense approval policy.
        </Typography>
      </div>

      {isUpdateError && (
        <Alert severity="error">
          Unable to update policy. Please try again.
        </Alert>
      )}

      <PolicyForm
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isSubmitting={isUpdating}
      />
    </Stack>
  );
}