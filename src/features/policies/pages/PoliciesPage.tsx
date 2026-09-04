import {
  Button,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { AddOutlined } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import { useGetPoliciesQuery } from "../api/policiesApi";
import { PolicyCard } from "../components/PolicyCard";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common//ErrorState";
import { usePermissions } from "../../auth/hooks/usePermissions";

export function PoliciesPage() {
  const navigate = useNavigate();

  const { can } = usePermissions();

  const {
    data: policies,
    isLoading,
    isError,
  } = useGetPoliciesQuery();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState />;
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{
          xs: "column",
          sm: "row",
        }}
        sx={{
          justifyContent: "space-between",
          alignItems: {
            xs: "flex-start",
            sm: "center",
          },
          gap: 2,
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h4">
            Policies
          </Typography>

          <Typography
            color="text.secondary"
          >
            Configure expense approval policies for your organization.
          </Typography>
        </Stack>

        {can("policies.create") && (
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() =>
              navigate("/policies/new")
            }
          >
            Create Policy
          </Button>
        )}
      </Stack>

      <Grid container spacing={2}>
        {(policies ?? []).map((policy) => (
          <Grid
            key={policy.id}
            size={{
              xs: 12,
              md: 6,
              lg: 4,
            }}
          >
            <PolicyCard
              policy={policy}
              onView={(selectedPolicy) =>
                navigate(
                  `/policies/${selectedPolicy.id}`,
                )
              }
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}