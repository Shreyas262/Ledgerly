import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useNavigate } from "react-router-dom";
import {
  Stack,
} from "@mui/material";
import { ApiFeedback } from "../../../components/common/ApiFeedback";

import PolicyForm from "../components/PolicyForm";
import {
  useCreatePolicyMutation,
} from "../api/policiesApi";
import type { CreateExpensePolicyRequest } from "../types/policy";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";

export function CreatePolicyPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [
    createPolicy,
    { isLoading, error },
  ] = useCreatePolicyMutation();

  const handleSubmit = async (
    values: CreateExpensePolicyRequest,
  ) => {
    if (!(await confirm({ title: "Create policy", message: `Create the policy "${values.name}"?`, confirmLabel: "Create" }))) return;
    try {
      const policy = await createPolicy(values).unwrap();

      navigate(`/policies/${policy.id}`);
    } catch {
      // Error state is displayed below.
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to="/policies" label="Policies" />
      <PageHeader
        title="Create Policy"
        description="Define spending rules for an expense type, for the whole organization or specific departments."
      />

      {error && <ApiFeedback error={error} />}

      <PolicyForm
        onSubmit={handleSubmit}
        isSubmitting={isLoading}
      />
    </Stack>
  );
}