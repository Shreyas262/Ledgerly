import { BackLink } from "../../../components/navigation/BackLink";
import { useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { EditOutlined } from "@mui/icons-material";

import {
  useGetCurrentUserQuery,
  useUpdateCurrentUserMutation,
} from "../../auth/api/authApi";
import { UserProfileForm } from "../components/UserProfileForm";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { humanize } from "../../../utils/format";
import { isPersonalAccount } from "../../auth/utils/accountType";
import { PageHeader } from "../../../components/common/PageHeader";

export function UserProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data, isLoading, isError, error: loadError, refetch } = useGetCurrentUserQuery();

  const [updateCurrentUser, { isLoading: isUpdating, error: updateError }] =
    useUpdateCurrentUserMutation();

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={loadError} onRetry={refetch} />;

  const user = data?.data;
  if (!user) {
    return <Alert severity="warning">User profile could not be found.</Alert>;
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isFinance = user.role === "finance";

  const handleUpdate = async (name: string, email: string) => {
    try {
      await updateCurrentUser({ name, email }).unwrap();
      setIsEditing(false);
      setShowSuccess(true);
    } catch {
      setShowSuccess(false);
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to="/account" label="Account" />
      <PageHeader
        title="My Profile"
        description="View and manage your Ledgerly account."
      />

      {showSuccess && (
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Your profile has been updated.
        </Alert>
      )}

      {updateError && <ApiFeedback error={updateError} />}

      <Card>
        <CardContent>
          {isEditing ? (
            <Stack spacing={2}>
              <Typography variant="h6">Edit profile</Typography>
              <UserProfileForm
                user={user}
                onSubmit={handleUpdate}
                onCancel={() => setIsEditing(false)}
                isSubmitting={isUpdating}
              />
            </Stack>
          ) : (
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 0 }}>
                <Avatar sx={{ width: 56, height: 56 }}>{initials}</Avatar>
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="h5">{user.name}</Typography>
                    <Chip size="small" label={isPersonalAccount(user) ? "Personal account" : humanize(user.role)} />
                  </Stack>
                  <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    {user.email}
                  </Typography>
                </Stack>
              </Stack>

              <Button
                variant="outlined"
                startIcon={<EditOutlined />}
                onClick={() => setIsEditing(true)}
                sx={{ alignSelf: { xs: "flex-start", sm: "center" }, flexShrink: 0 }}
              >
                Edit profile
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Personal accounts belong to no organization (§5.15). */}
      {!isPersonalAccount(user) && (
      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="h6">Organization</Typography>
              <Typography variant="body2" color="text.secondary">
                Where you sit in your organization. This determines which expenses, budgets and analytics you can see.
              </Typography>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ContextField label="Organization" value={user.organizationName} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ContextField label="Role" value={humanize(user.role)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ContextField label="Department" value={user.departmentName} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <ContextField label="Team" value={user.teamName} />
              </Grid>

              {isFinance && (
                <Grid size={{ xs: 12 }}>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Finance departments
                    </Typography>
                    {user.authorizedDepartmentNames?.length ? (
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                        {user.authorizedDepartmentNames.map((name) => (
                          <Chip key={name} size="small" label={name} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography>—</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Departments whose expenses and reimbursements you can process.
                    </Typography>
                  </Stack>
                </Grid>
              )}
            </Grid>
          </Stack>
        </CardContent>
      </Card>
      )}
    </Stack>
  );
}

function ContextField({ label, value }: { label: string; value?: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{value || "—"}</Typography>
    </Stack>
  );
}
