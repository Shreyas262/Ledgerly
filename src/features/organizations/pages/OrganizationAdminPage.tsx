import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  useCreateDepartmentMutation,
  useCreateTeamMutation,
  useDeleteDepartmentMutation,
  useDeleteTeamMutation,
  useGetDepartmentsQuery,
  useGetOrganizationQuery,
  useGetTeamsQuery,
  useUpdateDepartmentMutation,
  useUpdateOrganizationMutation,
  useUpdateTeamMutation,
} from "../api/organizationApi";
import type { Department, Team } from "../types/organization";

export function OrganizationAdminPage() {
  const organization = useGetOrganizationQuery();
  const departments = useGetDepartmentsQuery();
  const teams = useGetTeamsQuery();
  const [updateOrganization, orgMutation] = useUpdateOrganizationMutation();
  const [createDepartment] = useCreateDepartmentMutation();
  const [updateDepartment] = useUpdateDepartmentMutation();
  const [deleteDepartment] = useDeleteDepartmentMutation();
  const [createTeam] = useCreateTeamMutation();
  const [updateTeam] = useUpdateTeamMutation();
  const [deleteTeam] = useDeleteTeamMutation();

  const [orgName, setOrgName] = useState("");
  const [orgStatus, setOrgStatus] = useState<"active" | "inactive">("active");
  const [newDepartment, setNewDepartment] = useState("");
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newTeamDepartment, setNewTeamDepartment] = useState("");
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamDepartment, setTeamDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentOrganization = organization.data;

  useEffect(() => {
    if (!currentOrganization) return;
    setOrgName(currentOrganization.name);
    setOrgStatus(currentOrganization.status);
  }, [currentOrganization]);

  async function saveOrganization() {
    setError(null);
    try {
      await updateOrganization({ name: orgName.trim(), status: orgStatus }).unwrap();
    } catch {
      setError("Failed to update organization configuration.");
    }
  }

  async function addDepartment() {
    if (!newDepartment.trim()) return;
    setError(null);
    try {
      await createDepartment({ name: newDepartment.trim() }).unwrap();
      setNewDepartment("");
    } catch {
      setError("Failed to create department.");
    }
  }

  async function saveDepartment(department: Department) {
    setError(null);
    try {
      await updateDepartment({ id: department.id, body: { name: departmentName.trim(), status: department.status } }).unwrap();
      setEditingDepartment(null);
    } catch {
      setError("Failed to update department.");
    }
  }

  async function removeDepartment(id: string) {
    setError(null);
    try {
      await deleteDepartment(id).unwrap();
    } catch {
      setError("Department cannot be deleted while it is still referenced.");
    }
  }

  async function addTeam() {
    if (!newTeam.trim() || !newTeamDepartment) return;
    setError(null);
    try {
      await createTeam({ name: newTeam.trim(), departmentId: newTeamDepartment }).unwrap();
      setNewTeam("");
      setNewTeamDepartment("");
    } catch {
      setError("Failed to create team.");
    }
  }

  async function saveTeam(team: Team) {
    setError(null);
    try {
      await updateTeam({ id: team.id, body: { name: teamName.trim(), departmentId: teamDepartment, status: team.status } }).unwrap();
      setEditingTeam(null);
    } catch {
      setError("Failed to update team.");
    }
  }

  async function removeTeam(id: string) {
    setError(null);
    try {
      await deleteTeam(id).unwrap();
    } catch {
      setError("Team cannot be deleted while it is still referenced.");
    }
  }

  if (organization.isLoading || departments.isLoading || teams.isLoading) {
    return <Typography>Loading organization administration…</Typography>;
  }

  if (organization.isError || departments.isError || teams.isError || !currentOrganization) {
    return <Alert severity="error">Unable to load organization administration.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Organization Administration</Typography>
        <Typography color="text.secondary">
          Manage organization configuration and organizational structure. Changes are validated and audited by the API.
        </Typography>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Organization Configuration</Typography>
            <TextField label="Organization name" value={orgName} onChange={(event) => setOrgName(event.target.value)} fullWidth />
            <Select value={orgStatus} onChange={(event) => setOrgStatus(event.target.value as "active" | "inactive")}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            <Button variant="contained" onClick={saveOrganization} disabled={orgMutation.isLoading || !orgName.trim()}>
              {orgMutation.isLoading ? "Saving…" : "Save Configuration"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Departments</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="New department" value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} fullWidth />
              <Button variant="contained" onClick={addDepartment} disabled={!newDepartment.trim()}>Create</Button>
            </Stack>
            <Divider />
            {departments.data?.map((department) => (
              <Stack key={department.id} direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                {editingDepartment === department.id ? (
                  <TextField value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} fullWidth />
                ) : (
                  <Typography>{department.name}</Typography>
                )}
                <Stack direction="row" spacing={1}>
                  {editingDepartment === department.id ? (
                    <>
                      <Button onClick={() => saveDepartment(department)} disabled={!departmentName.trim()}>Save</Button>
                      <Button onClick={() => setEditingDepartment(null)}>Cancel</Button>
                    </>
                  ) : (
                    <Button onClick={() => { setEditingDepartment(department.id); setDepartmentName(department.name); }}>Edit</Button>
                  )}
                  <Button color="error" onClick={() => removeDepartment(department.id)}>Delete</Button>
                </Stack>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Teams</Typography>
            <Stack spacing={2}>
              <TextField label="New team" value={newTeam} onChange={(event) => setNewTeam(event.target.value)} fullWidth />
              <Select displayEmpty value={newTeamDepartment} onChange={(event) => setNewTeamDepartment(event.target.value)}>
                <MenuItem value="">Select department</MenuItem>
                {departments.data?.map((department) => <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>)}
              </Select>
              <Button variant="contained" onClick={addTeam} disabled={!newTeam.trim() || !newTeamDepartment}>Create Team</Button>
            </Stack>
            <Divider />
            {teams.data?.map((team) => (
              <Stack key={team.id} spacing={1}>
                {editingTeam === team.id ? (
                  <>
                    <TextField value={teamName} onChange={(event) => setTeamName(event.target.value)} fullWidth />
                    <Select value={teamDepartment} onChange={(event) => setTeamDepartment(event.target.value)}>
                      {departments.data?.map((department) => <MenuItem key={department.id} value={department.id}>{department.name}</MenuItem>)}
                    </Select>
                    <Stack direction="row" spacing={1}>
                      <Button onClick={() => saveTeam(team)} disabled={!teamName.trim() || !teamDepartment}>Save</Button>
                      <Button onClick={() => setEditingTeam(null)}>Cancel</Button>
                    </Stack>
                  </>
                ) : (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                    <Stack>
                      <Typography>{team.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {departments.data?.find((department) => department.id === team.departmentId)?.name ?? "Unknown department"}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button onClick={() => { setEditingTeam(team.id); setTeamName(team.name); setTeamDepartment(team.departmentId); }}>Edit</Button>
                      <Button color="error" onClick={() => removeTeam(team.id)}>Delete</Button>
                    </Stack>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
