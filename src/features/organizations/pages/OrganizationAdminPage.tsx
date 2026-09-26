import { BackLink } from "../../../components/navigation/BackLink";
import { getApiErrorMessage } from "../../../services/api/apiErrors";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  useAddTeamMemberMutation,
  useCreateDepartmentMutation,
  useCreateTeamMutation,
  useDeleteDepartmentMutation,
  useDeleteTeamMutation,
  useGetDepartmentsQuery,
  useGetOrganizationQuery,
  useGetTeamsQuery,
  useSetDepartmentFinanceUsersMutation,
  useUpdateDepartmentMutation,
  useUpdateOrganizationMutation,
  useUpdateTeamMutation,
} from "../api/organizationApi";
import { useGetUsersQuery } from "../../users/api/usersApi";
import { useConfirm, type ConfirmOptions } from "../../../components/common/ConfirmProvider";
import type { User } from "../../users/types/user";
import type { Department, Team } from "../types/organization";

type Status = "active" | "inactive";

export function OrganizationAdminPage() {
  const organization = useGetOrganizationQuery();
  const departments = useGetDepartmentsQuery();
  const teams = useGetTeamsQuery();
  const users = useGetUsersQuery({ page: 1, pageSize: 100 });
  const [updateOrganization, orgMutation] = useUpdateOrganizationMutation();
  const [createDepartment] = useCreateDepartmentMutation();
  const [createTeam] = useCreateTeamMutation();

  const [orgName, setOrgName] = useState("");
  const [orgStatus, setOrgStatus] = useState<Status>("active");
  const [newDepartment, setNewDepartment] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newTeamDepartment, setNewTeamDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const confirm = useConfirm();

  const currentOrganization = organization.data;

  useEffect(() => {
    if (!currentOrganization) return;
    setOrgName(currentOrganization.name);
    setOrgStatus(currentOrganization.status);
  }, [currentOrganization]);

  /** Runs an admin mutation and reports the API's reason on failure. */
  const run = async (action: () => Promise<unknown>, fallback: string, success?: string, confirmation?: ConfirmOptions) => {
    if (confirmation && !(await confirm(confirmation))) return false;
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
      return true;
    } catch (caught) {
      setError(getApiErrorMessage(caught, fallback));
      return false;
    }
  };

  if (organization.isLoading || departments.isLoading || teams.isLoading || users.isLoading) {
    return <LoadingState message="Loading organization administration…" />;
  }

  if (organization.isError || departments.isError || teams.isError || users.isError || !currentOrganization) {
    return (
      <ErrorState
        error={organization.error ?? departments.error ?? teams.error ?? users.error}
        onRetry={() => {
          organization.refetch();
          departments.refetch();
          teams.refetch();
          users.refetch();
        }}
      />
    );
  }

  const allDepartments = departments.data ?? [];
  const allTeams = teams.data ?? [];
  const allUsers = users.data?.data ?? [];

  return (
    <Stack spacing={3}>
      <BackLink to="/admin" label="Administration" />
      <Stack spacing={0.5}>
        <Typography variant="h4">Organization Administration</Typography>
        <Typography color="text.secondary">
          Manage departments, teams and who belongs to them. Changes are validated and audited by the API.
        </Typography>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Organization Configuration</Typography>
            <TextField label="Organization name" value={orgName} onChange={(event) => setOrgName(event.target.value)} fullWidth />
            <Select value={orgStatus} onChange={(event) => setOrgStatus(event.target.value as Status)}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            <Button
              variant="contained"
              onClick={() => run(() => updateOrganization({ name: orgName.trim(), status: orgStatus }).unwrap(), "Failed to update organization configuration.", "Organization configuration saved.", { title: "Save configuration", message: "Save the organization configuration?", confirmLabel: "Save" })}
              disabled={orgMutation.isLoading || !orgName.trim()}
            >
              {orgMutation.isLoading ? "Saving…" : "Save Configuration"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2}>
        <Typography variant="h5">Departments</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label="New department" value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} fullWidth />
          <Button
            variant="contained"
            disabled={!newDepartment.trim()}
            onClick={async () => {
              if (await run(() => createDepartment({ name: newDepartment.trim() }).unwrap(), "Failed to create department.", "Department created.", { title: "Create department", message: `Create the department "${newDepartment.trim()}"?`, confirmLabel: "Create" })) {
                setNewDepartment("");
              }
            }}
          >
            Create
          </Button>
        </Stack>
        {allDepartments.map((department) => (
          <DepartmentCard
            key={department.id}
            department={department}
            teams={allTeams}
            users={allUsers}
            run={run}
          />
        ))}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h5">Teams</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField label="New team" value={newTeam} onChange={(event) => setNewTeam(event.target.value)} fullWidth />
          <FormControl fullWidth>
            <InputLabel id="new-team-department">Department</InputLabel>
            <Select labelId="new-team-department" label="Department" value={newTeamDepartment} onChange={(event) => setNewTeamDepartment(event.target.value)}>
              {allDepartments.filter((department) => department.status === "active").map((department) => (
                <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            disabled={!newTeam.trim() || !newTeamDepartment}
            onClick={async () => {
              if (await run(() => createTeam({ name: newTeam.trim(), departmentId: newTeamDepartment }).unwrap(), "Failed to create team.", "Team created.", { title: "Create team", message: `Create the team "${newTeam.trim()}"?`, confirmLabel: "Create" })) {
                setNewTeam("");
                setNewTeamDepartment("");
              }
            }}
          >
            Create Team
          </Button>
        </Stack>
        {allTeams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            teams={allTeams}
            departments={allDepartments}
            users={allUsers}
            run={run}
          />
        ))}
      </Stack>
    </Stack>
  );
}

type Runner = (action: () => Promise<unknown>, fallback: string, success?: string, confirmation?: ConfirmOptions) => Promise<boolean>;

const isRole = (user: User, role: string) => String(user.role).toLowerCase() === role;
const authorizedDepartments = (user: User) =>
  user.financeDepartmentIds?.length ? user.financeDepartmentIds : [user.departmentId];

function DepartmentCard({ department, teams, users, run }: {
  department: Department;
  teams: Team[];
  users: User[];
  run: Runner;
}) {
  const [updateDepartment] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const [updateTeam] = useUpdateTeamMutation();
  const [setFinanceUsers, financeMutation] = useSetDepartmentFinanceUsersMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(department.name);
  const [status, setStatus] = useState<Status>(department.status);
  const [teamToMove, setTeamToMove] = useState("");

  const departmentTeams = teams.filter((team) => team.departmentId === department.id);
  const members = users.filter((user) => user.departmentId === department.id);
  const activeMembers = members.filter((user) => user.status !== "inactive").length;
  const financeUsers = users.filter((user) => isRole(user, "finance"));
  const authorizedFinance = financeUsers.filter((user) => authorizedDepartments(user).includes(department.id)).map((user) => user.id);
  const [financeSelection, setFinanceSelection] = useState<string[]>(authorizedFinance);
  const authorizedKey = authorizedFinance.join(",");

  useEffect(() => {
    setFinanceSelection(authorizedKey ? authorizedKey.split(",") : []);
  }, [authorizedKey]);

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
            {editing ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flex: 1 }}>
                <TextField label="Department name" value={name} onChange={(event) => setName(event.target.value)} fullWidth />
                <Select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </Stack>
            ) : (
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="h6">{department.name}</Typography>
                  {department.status === "inactive" && <Chip size="small" label="Inactive" />}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {departmentTeams.length} team(s) · {activeMembers} active member(s)
                </Typography>
              </Stack>
            )}
            <Stack direction="row" spacing={1}>
              {editing ? (
                <>
                  <Button
                    disabled={!name.trim()}
                    onClick={async () => {
                      if (await run(() => updateDepartment({ id: department.id, body: { name: name.trim(), status } }).unwrap(), "Failed to update department.", "Department updated.", { title: "Save department", message: `Save changes to ${department.name}?`, confirmLabel: "Save" })) {
                        setEditing(false);
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button onClick={() => { setEditing(false); setName(department.name); setStatus(department.status); }}>Cancel</Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)}>Edit</Button>
              )}
              <Button color="error" onClick={() => run(() => deleteDepartment(department.id).unwrap(), "Department cannot be deleted while it is still referenced.", "Department deleted.", { title: "Delete department", message: `Delete ${department.name}? This cannot be undone.`, confirmLabel: "Delete", destructive: true })}>
                Delete
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Teams</Typography>
            {departmentTeams.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No teams in this department.</Typography>
            ) : (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {departmentTeams.map((team) => (
                  <Chip key={team.id} label={`${team.name} (${users.filter((user) => user.teamId === team.id).length})`} />
                ))}
              </Stack>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel id={`move-team-${department.id}`}>Move a team here</InputLabel>
                <Select labelId={`move-team-${department.id}`} label="Move a team here" value={teamToMove} onChange={(event) => setTeamToMove(event.target.value)}>
                  {teams.filter((team) => team.departmentId !== department.id).map((team) => (
                    <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                disabled={!teamToMove || department.status !== "active"}
                onClick={async () => {
                  const team = teams.find((item) => item.id === teamToMove);
                  if (!team) return;
                  if (await run(
                    () => updateTeam({ id: team.id, body: { name: team.name, departmentId: department.id, status: team.status } }).unwrap(),
                    "Failed to move team.",
                    `${team.name} moved to ${department.name}; its members moved with it.`,
                    { title: "Move team", message: `Move ${team.name} to ${department.name}? Its members move to the department too.`, confirmLabel: "Move" },
                  )) {
                    setTeamToMove("");
                  }
                }}
              >
                Move
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Authorized Finance users</Typography>
            {financeUsers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">There are no Finance users in the organization.</Typography>
            ) : (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 240 }}>
                  <InputLabel id={`finance-${department.id}`}>Finance users</InputLabel>
                  <Select
                    labelId={`finance-${department.id}`}
                    label="Finance users"
                    multiple
                    value={financeSelection}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFinanceSelection(typeof value === "string" ? value.split(",") : value);
                    }}
                    renderValue={(selected) => selected.map((id) => financeUsers.find((user) => user.id === id)?.name ?? id).join(", ")}
                  >
                    {financeUsers.map((user) => (
                      <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  disabled={financeMutation.isLoading || financeSelection.join(",") === authorizedKey}
                  onClick={() => run(
                    () => setFinanceUsers({ departmentId: department.id, userIds: financeSelection }).unwrap(),
                    "Failed to update Finance authorization.",
                    `Finance authorization updated for ${department.name}.`,
                    { title: "Update Finance authorization", message: `Save which Finance users can process ${department.name}'s expenses?`, confirmLabel: "Save" },
                  )}
                >
                  Save
                </Button>
              </Stack>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function TeamCard({ team, teams, departments, users, run }: {
  team: Team;
  teams: Team[];
  departments: Department[];
  users: User[];
  run: Runner;
}) {
  const [updateTeam] = useUpdateTeamMutation();
  const [deleteTeam] = useDeleteTeamMutation();
  const [addTeamMember] = useAddTeamMemberMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [departmentId, setDepartmentId] = useState(team.departmentId);
  const [status, setStatus] = useState<Status>(team.status);
  const [userToAdd, setUserToAdd] = useState("");

  const members = users.filter((user) => user.teamId === team.id);
  const manager = members.find((user) => isRole(user, "manager") && user.status !== "inactive");
  const otherTeams = teams.filter((item) => item.id !== team.id && item.status === "active");
  const departmentName = departments.find((department) => department.id === team.departmentId)?.name ?? "Unknown department";

  const moveUser = (user: User, target: Team) =>
    run(
      () => addTeamMember({ teamId: target.id, userId: user.id }).unwrap(),
      "Failed to move user.",
      `${user.name} moved to ${target.name}.`,
      { title: "Move user", message: `Move ${user.name} to ${target.name}? Their department follows the team.`, confirmLabel: "Move" },
    );

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
            {editing ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flex: 1 }}>
                <TextField label="Team name" value={name} onChange={(event) => setName(event.target.value)} fullWidth />
                <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  {departments.filter((department) => department.status === "active").map((department) => (
                    <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>
                  ))}
                </Select>
                <Select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </Stack>
            ) : (
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="h6">{team.name}</Typography>
                  {team.status === "inactive" && <Chip size="small" label="Inactive" />}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {departmentName} · {members.length} member(s) · Manager: {manager?.name ?? "none"}
                </Typography>
              </Stack>
            )}
            <Stack direction="row" spacing={1}>
              {editing ? (
                <>
                  <Button
                    disabled={!name.trim() || !departmentId}
                    onClick={async () => {
                      if (await run(() => updateTeam({ id: team.id, body: { name: name.trim(), departmentId, status } }).unwrap(), "Failed to update team.", "Team updated.", { title: "Save team", message: `Save changes to ${team.name}?`, confirmLabel: "Save" })) {
                        setEditing(false);
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button onClick={() => { setEditing(false); setName(team.name); setDepartmentId(team.departmentId); setStatus(team.status); }}>Cancel</Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)}>Edit</Button>
              )}
              <Button color="error" onClick={() => run(() => deleteTeam(team.id).unwrap(), "Team cannot be deleted while it is still referenced.", "Team deleted.", { title: "Delete team", message: `Delete ${team.name}? This cannot be undone.`, confirmLabel: "Delete", destructive: true })}>
                Delete
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle2">Members</Typography>
            {members.length === 0 && (
              <Typography variant="body2" color="text.secondary">No members yet.</Typography>
            )}
            {members.map((user) => (
              <Stack key={user.id} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography>{user.name}</Typography>
                  <Chip size="small" label={user.role} color={isRole(user, "manager") ? "primary" : "default"} />
                  {user.status === "inactive" && <Chip size="small" label="Inactive" />}
                </Stack>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id={`move-${team.id}-${user.id}`}>Move to team</InputLabel>
                  <Select
                    labelId={`move-${team.id}-${user.id}`}
                    label="Move to team"
                    value=""
                    onChange={(event) => {
                      const target = teams.find((item) => item.id === event.target.value);
                      if (target) void moveUser(user, target);
                    }}
                  >
                    {otherTeams.map((item) => (
                      <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            ))}
            <Typography variant="caption" color="text.secondary">
              Every user belongs to exactly one team, so removing a member means moving them to another team. Their department follows the team.
            </Typography>
          </Stack>

          {team.status === "active" && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel id={`add-${team.id}`}>Add member</InputLabel>
                <Select labelId={`add-${team.id}`} label="Add member" value={userToAdd} onChange={(event) => setUserToAdd(event.target.value)}>
                  {users.filter((user) => user.teamId !== team.id).map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name} ({user.role}, {teams.find((item) => item.id === user.teamId)?.name ?? "no team"})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                disabled={!userToAdd}
                onClick={async () => {
                  const user = users.find((item) => item.id === userToAdd);
                  if (user && await moveUser(user, team)) setUserToAdd("");
                }}
              >
                Add
              </Button>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
