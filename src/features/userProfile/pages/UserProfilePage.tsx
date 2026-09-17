import { useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { useGetCurrentUserQuery } from "../../auth/api/authApi";
import { useUpdateUserMutation } from "../../users/api/usersApi";
import { UserProfileForm } from "../components/UserProfileForm";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

export function UserProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data, isLoading, isError } = useGetCurrentUserQuery();

  const [updateUser, { isLoading: isUpdating, isError: isUpdateError }] =
    useUpdateUserMutation();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState message="Unable to load your profile." />;
  }

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
      await updateUser({
        id: user.id,
        body: {
          name,
          email,
          role: user.role,
          permissions: user.permissions,
        },
      }).unwrap();

      setIsEditing(false);
      setShowSuccess(true);
    } catch {
      setShowSuccess(false);
    }
  };

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
        {showSuccess && (
          <Alert severity="success" onClose={() => setShowSuccess(false)}>
            Your profile has been updated successfully.
          </Alert>
        )}
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

      {isUpdateError && (
        <Alert severity="error">
          Unable to update your profile. Please try again.
        </Alert>
      )}

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
        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  alignItems: "center",
                }}
              >
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                  }}
                >
                  {initials}
                </Avatar>

                <Stack spacing={0.5}>
                  <Typography variant="h5">{user.name}</Typography>

                  <Typography color="text.secondary">{user.email}</Typography>
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={2}>
                <Typography variant="h6">Personal Information</Typography>

                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Name
                  </Typography>

                  <Typography>{user.name}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    Email
                  </Typography>

                  <Typography>{user.email}</Typography>
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
