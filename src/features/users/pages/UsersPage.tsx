import { useConfirm } from "../../../components/common/ConfirmProvider";
import { BackLink } from "../../../components/navigation/BackLink";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Pagination,
} from "@mui/material";

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { useDeferredValue, useMemo, useState } from "react";

import { useGetUsersQuery } from "../api/usersApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { useAuth } from "../../auth/context/AuthContext";
import { CreateUserForm } from "../components/CreateUserForm";
import { EditUserDialog } from "../components/EditUserDialog";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import {
  useDeleteUserMutation,
  useUpdateUserStatusMutation,
} from "../api/usersApi";
import { useGetDepartmentsQuery, useGetTeamsQuery } from "../../organizations/api/organizationApi";
import { useGetRolesQuery } from "../../roles/api/rolesApi";
import { GroupedPermissions } from "../../roles/components/GroupedPermissions";
import type { User } from "../types/user";
import { PageHeader } from "../../../components/common/PageHeader";
import { humanize } from "../../../utils/format";

const ACTION_SX = { minWidth: 132 };

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

export function UsersPage() {
  const { can } = usePermissions();
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const query = useMemo(() => ({
    page,
    pageSize: 25,
    search: deferredSearch.trim() || undefined,
    filter: {
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(departmentFilter ? { departmentId: departmentFilter } : {}),
    },
  }), [page, deferredSearch, roleFilter, statusFilter, departmentFilter]);

  const {
    data: users,
    isLoading,
    isFetching,
    isError,
    error: usersError,
    refetch,
  } = useGetUsersQuery(query);
  const { data: departments = [] } = useGetDepartmentsQuery();
  const { data: teams = [] } = useGetTeamsQuery();
  const { data: roles = [] } = useGetRolesQuery();

  const [updateUserStatus] = useUpdateUserStatusMutation();
  const confirm = useConfirm();

  const [deleteUser, { isLoading: isDeleting, error: deleteError }] =
    useDeleteUserMutation();

  if (!can("users.read"))
    return (
      <ErrorState
        title="Access denied"
        message="You do not have permission to view users."
      />
    );

  if (isLoading) return <LoadingState />;

  if (isError) return <ErrorState error={usersError} onRetry={refetch} />;

  const departmentName = (id: string) => departments.find((item) => item.id === id)?.name ?? "—";
  const teamName = (id: string) => teams.find((item) => item.id === id)?.name ?? "—";
  const hasFilters = Boolean(search || roleFilter || statusFilter || departmentFilter);
  const updateFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  async function handleDelete() {
    if (!deletingUser) return;

    try {
      await deleteUser(deletingUser.id).unwrap();

      setDeletingUser(null);
    } catch {
      // Close the dialog so the reason (exposed through deleteError) is visible.
      setDeletingUser(null);
    }
  }

  const toggleStatus = (user: User) =>
    confirm({
      title: user.status === "inactive" ? "Activate user" : "Deactivate user",
      message: user.status === "inactive"
        ? `Allow ${user.name} to sign in again?`
        : `${user.name} will no longer be able to sign in. Continue?`,
      confirmLabel: user.status === "inactive" ? "Activate" : "Deactivate",
      destructive: user.status !== "inactive",
    }).then((ok) => {
      if (ok) void updateUserStatus({ id: user.id, status: user.status === "inactive" ? "active" : "inactive" });
    });

  return (
    <>
      <Stack spacing={3}>
        <BackLink to="/admin" label="Administration" />
        <PageHeader
          title="Users"
          description="Manage who can sign in, their role, and where they sit in the organization."
          actions={can("users.create") && (
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create User
            </Button>
          )}
        />

        {deleteError && <ApiFeedback error={deleteError} />}

        {/* Filters */}
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
          <TextField
            size="small"
            placeholder="Search by name or email"
            value={search}
            onChange={(event) => updateFilter(setSearch)(event.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <TextField select size="small" label="Role" value={roleFilter} onChange={(event) => updateFilter(setRoleFilter)(event.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="">All roles</MenuItem>
            {roles.map((role) => (
              <MenuItem key={role.id} value={role.name}>{humanize(role.name)}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Status" value={statusFilter} onChange={(event) => updateFilter(setStatusFilter)(event.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>
          <TextField select size="small" label="Department" value={departmentFilter} onChange={(event) => updateFilter(setDepartmentFilter)(event.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All departments</MenuItem>
            {departments.map((department) => (
              <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>
            ))}
          </TextField>
          {hasFilters && (
            <Button
              onClick={() => {
                setSearch("");
                setRoleFilter("");
                setStatusFilter("");
                setDepartmentFilter("");
                setPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </Stack>

        {users && (
          <Typography variant="body2" color="text.secondary">
            {users.total} {users.total === 1 ? "user" : "users"}{isFetching ? " · updating…" : ""}
          </Typography>
        )}

        {/* Users */}
        {!users?.data.length ? (
          <EmptyState message={hasFilters ? "No users match these filters." : undefined} />
        ) : (
          <Stack spacing={2}>
            {users.data.map((user) => {
              const isSelf = user.id === currentUser?.id;
              const financeDepartments = (user.financeDepartmentIds ?? []).map(departmentName);
              return (
                <Card key={user.id}>
                  <CardContent>
                    <Stack spacing={2}>
                      {/* Identity */}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                          <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText", width: 44, height: 44, fontSize: 16 }}>
                            {initials(user.name)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                              <Typography variant="subtitle1" noWrap>{user.name}</Typography>
                              {isSelf && <Chip label="You" size="small" color="primary" variant="outlined" />}
                            </Stack>
                            <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                          <Chip label={humanize(user.role)} variant="outlined" size="small" />
                          <Chip
                            label={user.status === "inactive" ? "Inactive" : "Active"}
                            color={user.status === "inactive" ? "default" : "success"}
                            size="small"
                          />
                        </Stack>
                      </Stack>

                      {/* Placement */}
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 4 }}>
                        <Typography variant="body2"><Box component="span" sx={{ color: "text.secondary" }}>Department: </Box>{departmentName(user.departmentId)}</Typography>
                        <Typography variant="body2"><Box component="span" sx={{ color: "text.secondary" }}>Team: </Box>{teamName(user.teamId)}</Typography>
                        {user.role === "finance" && (
                          <Typography variant="body2">
                            <Box component="span" sx={{ color: "text.secondary" }}>Finance for: </Box>
                            {financeDepartments.length ? financeDepartments.join(", ") : "No departments"}
                          </Typography>
                        )}
                      </Stack>

                      <Divider />

                      {/* Permissions */}
                      <Stack spacing={1}>
                        <Typography variant="subtitle2">Permissions ({user.permissions.length})</Typography>
                        <GroupedPermissions permissions={user.permissions} />
                      </Stack>

                      {/* Actions */}
                      {(can("users.update") || can("users.delete")) && (
                        <>
                          <Divider />
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ justifyContent: "flex-end" }}>
                            {can("users.update") && (
                              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditingUser(user)} sx={ACTION_SX}>
                                Edit
                              </Button>
                            )}
                            {/* Admins cannot deactivate or delete their own account. */}
                            {can("users.update") && !isSelf && (
                              <Button
                                variant="outlined"
                                color={user.status === "inactive" ? "success" : "warning"}
                                startIcon={user.status === "inactive" ? <CheckCircleOutlineIcon /> : <BlockOutlinedIcon />}
                                onClick={() => toggleStatus(user)}
                                sx={ACTION_SX}
                              >
                                {user.status === "inactive" ? "Activate" : "Deactivate"}
                              </Button>
                            )}
                            {can("users.delete") && !isSelf && (
                              <Button variant="outlined" color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => setDeletingUser(user)} sx={ACTION_SX}>
                                Delete
                              </Button>
                            )}
                          </Stack>
                        </>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}

        {users && users.total > users.pageSize && (
          <Stack sx={{ alignItems: "center" }}>
            <Pagination
              page={users.page}
              count={Math.ceil(users.total / users.pageSize)}
              onChange={(_event, nextPage) => setPage(nextPage)}
              color="primary"
            />
          </Stack>
        )}
      </Stack>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Create User</DialogTitle>

        <DialogContent dividers>
          <CreateUserForm onSuccess={() => setCreateDialogOpen(false)} onCancel={() => setCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editingUser}
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
      />

      {/* Delete User */}
      <ConfirmDialog
        open={Boolean(deletingUser)}
        title="Delete User?"
        message={
          deletingUser
            ? `Delete ${deletingUser.name}? They lose access and are removed from their team and department. Their expense history is kept; drafts are cancelled and submitted expenses continue through approval and reimbursement.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingUser(null)}
      />
    </>
  );
}
