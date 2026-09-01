import { useState } from "react";
import type { SyntheticEvent } from "react";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { RoleName } from "../../../types/auth";

import { useCreateUserMutation } from "../api/usersApi";
import { useGetRolesQuery } from "../../../features/roles/api/rolesApi";

import { permissionGroups } from "../../../mocks/data/permissions";

interface CreateUserFormProps {
  onSuccess?: () => void;
}

const ORGANIZATION_ID = "org-1";

export function CreateUserForm({
  onSuccess,
}: CreateUserFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleName>("employee");

  const {
    data: roles,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useGetRolesQuery();

  const [
    createUser,
    {
      isLoading: isCreating,
      isError: createUserError,
    },
  ] = useCreateUserMutation();

  const selectedRole = roles?.find(
    (item) => item.name === role,
  );

  const selectedPermissions =
    selectedRole?.permissions ?? [];

  async function handleSubmit(
    event: SyntheticEvent,
  ) {
    event.preventDefault();

    try {
      await createUser({
        organizationId: ORGANIZATION_ID,
        name,
        email,
        password,
        role,
        permissions: selectedPermissions,
      }).unwrap();

      setName("");
      setEmail("");
      setPassword("");
      setRole("employee");

      onSuccess?.();
    } catch {
      // Error is exposed through createUserError.
    }
  }

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit}
      spacing={3}
    >
      {/* Basic information */}
      <Stack spacing={2}>

        <TextField
          label="Name"
          value={name}
          onChange={(event) =>
            setName(event.target.value)
          }
          required
          fullWidth
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          required
          fullWidth
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          required
          fullWidth
        />
      </Stack>

      {/* Role */}
      <FormControl fullWidth>
        <InputLabel id="user-role-label">
          Role
        </InputLabel>

        <Select
          labelId="user-role-label"
          value={roles ? role : ""}
          label="Role"
          disabled={rolesLoading || rolesError}
          onChange={(event) =>
            setRole(event.target.value as RoleName)
          }
        >
          {roles?.map((item) => (
            <MenuItem
              key={item.id}
              value={item.name}
            >
              {item.name.charAt(0).toUpperCase() +
                item.name.slice(1)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Permissions */}
      <Stack spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" sx={{fontWeight: 600}}>
            Permissions
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Permissions are inherited from the selected
            role.
          </Typography>
        </Stack>

        {Object.entries(permissionGroups).map(
          ([groupName, groupPermissions]) => {
            const availablePermissions =
              groupPermissions.filter((permission) =>
                selectedPermissions.includes(permission),
              );

            if (!availablePermissions.length) {
              return null;
            }

            return (
              <Card
                key={groupName}
                variant="outlined"
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography
                      variant="subtitle2"
                      sx={{fontWeight: 700}}
                    >
                      {groupName}
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      {availablePermissions.map(
                        (permission) => (
                          <Chip
                            key={permission}
                            label={permission.split(".")[1]}
                            size="small"
                          />
                        ),
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          },
        )}
      </Stack>

      {/* Errors */}
      {rolesError && (
        <Typography color="error">
          Failed to load roles.
        </Typography>
      )}

      {createUserError && (
        <Typography color="error">
          Failed to create user.
        </Typography>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="contained"
        disabled={
          isCreating ||
          rolesLoading ||
          rolesError ||
          !selectedRole
        }
      >
        {isCreating ? "Creating..." : "Create User"}
      </Button>
    </Stack>
  );
}