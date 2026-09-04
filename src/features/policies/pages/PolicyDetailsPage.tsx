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

export function PolicyDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const {
    data: policy,
    isLoading,
    isError,
  } = useGetPolicyByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState message="Unable to load policy." />;
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
                Approval Limit
              </Typography>

              <Typography variant="h5">
                ₹{policy.approvalLimit.toLocaleString("en-IN")}
              </Typography>
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
                      : "Inactive"
                  }
                  color={
                    policy.status === "active"
                      ? "success"
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
