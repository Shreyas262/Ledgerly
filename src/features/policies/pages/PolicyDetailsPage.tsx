import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import {
  useGetPolicyByIdQuery,
} from "../api/policiesApi";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { Amount } from "../../../components/common/Amount";

export function PolicyDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const {
    data: policy,
    isLoading,
    isError,
    error: policyError,
    refetch,
  } = useGetPolicyByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={policyError} onRetry={refetch} />;
  }

  if (!policy) {
    return <Alert severity="warning">Policy not found.</Alert>;
  }

  const canUpdate = can("policies.update");

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Typography variant="h4">
            {policy.name}
          </Typography>

          <Typography color="text.secondary">
            Expense policy details
          </Typography>
        </div>

        {canUpdate && (
          <Button
            variant="contained"
            onClick={() => navigate(`/policies/${policy.id}/edit`)}
          >
            Edit Policy
          </Button>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>

              <Typography>
                {policy.description || "No description provided."}
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Expense Type
              </Typography>
              <Typography>
                {policy.expenseType
                  ? policy.expenseType.replaceAll("_", " ")
                  : "All Expense Types"}
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Approval Limit
              </Typography>

              <Typography variant="h5">
                <Amount value={policy.approvalLimit} />
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Policy Rules
              </Typography>
              <Typography variant="body2">
                Approval threshold: <Amount value={policy.rule?.approvalThreshold ?? policy.approvalLimit} />
              </Typography>
              {policy.rule?.maximumAmount !== undefined && (
                <Typography variant="body2">
                  Maximum amount: <Amount value={policy.rule.maximumAmount} />
                </Typography>
              )}
              {policy.rule?.requiresReceipt && (
                <Typography variant="body2">Receipt required</Typography>
              )}
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Status
              </Typography>

              <div>
                <Chip
                  label={
                    policy.status === "active"
                      ? "Active"
                      : policy.status === "draft"
                        ? "Draft"
                        : "Inactive"
                  }
                  color={
                    policy.status === "active"
                      ? "success"
                      : policy.status === "draft"
                        ? "warning"
                        : "default"
                  }
                />
              </div>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Created
              </Typography>

              <Typography>
                {new Date(policy.createdAt).toLocaleString("en-IN")}
              </Typography>
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated
              </Typography>

              <Typography>
                {new Date(policy.updatedAt).toLocaleString("en-IN")}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
