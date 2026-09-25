import { useNavigate } from "react-router-dom";
import {
  Stack,
  Typography,
} from "@mui/material";
import { ApiFeedback } from "../../../components/common/ApiFeedback";

import PolicyForm from "../components/PolicyForm";
import {
  useCreatePolicyMutation,
} from "../api/policiesApi";
import type { CreateExpensePolicyRequest } from "../types/policy";

export function CreatePolicyPage() {
  const navigate = useNavigate();

  const [
    createPolicy,
    { isLoading, error },
  ] = useCreatePolicyMutation();

  const handleSubmit = async (
    values: CreateExpensePolicyRequest,
  ) => {
    try {
      const policy = await createPolicy(values).unwrap();

      navigate(`/policies/${policy.id}`);
    } catch {
      // Error state is displayed below.
    }
  };

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">
          Create Policy
        </Typography>

        <Typography color="text.secondary">
          Define an expense approval policy.
        </Typography>
      </div>

      {error && <ApiFeedback error={error} />}

      <PolicyForm
        onSubmit={handleSubmit}
        isSubmitting={isLoading}
      />
    </Stack>
  );
}