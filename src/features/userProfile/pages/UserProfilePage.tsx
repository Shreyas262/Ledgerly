import { BackLink } from "../../../components/navigation/BackLink";
import { useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";

import {
  useGetCurrentUserQuery,
  useUpdateCurrentUserMutation,
} from "../../auth/api/authApi";
import { UserProfileForm } from "../components/UserProfileForm";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";

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
      <Stack
        direction="row"
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <Typography variant="h4">My Profile</Typography>
          <Typography color="text.secondary">
            View and manage your Ledgerly account.
          </Typography>
        </div>

        {!isEditing && (
          <Button variant="contained" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        )}
      </Stack>

      {showSuccess && (
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Your profile has been updated successfully.
        </Alert>
      )}

      {updateError && <ApiFeedback error={updateError} />}

      {isEditing ? (
        <Stack spacing={2}>
          <UserProfileForm
            user={user}
            onSubmit={handleUpdate}
            isSubmitting={isUpdating}
          />
          <Button
            variant="outlined"
            onClick={() => setIsEditing(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
        </Stack>
      ) : (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  <Avatar sx={{ width: 64, height: 64 }}>{initials}</Avatar>
                  <Stack spacing={0.5}>
                    <Typography variant="h5">{user.name}</Typography>
                    <Typography color="text.secondary">{user.email}</Typography>
                  </Stack>
                </Stack>

                <Divider />

                <Stack spacing={2}>
                  <Typography variant="h6">Personal Information</Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">Name</Typography>
                    <Typography>{user.name}</Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">Email</Typography>
                    <Typography>{user.email}</Typography>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography variant="h6">Organization Context</Typography>
                  <Typography variant="body2" color="text.secondary">
                    This context is resolved from the authenticated principal and is used by authorization and scoped application features.
                  </Typography>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ContextField label="Organization" value={user.organizationId} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ContextField label="Department" value={user.departmentId} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ContextField label="Team" value={user.teamId} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <ContextField label="Role" value={user.role} />
                  </Grid>
                </Grid>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
    </Stack>
  );
}
