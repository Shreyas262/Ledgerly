import { apiError } from "../services/apiError";
import { applyCollectionQuery, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import { authorizeCollection, authorizeRequest } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { getRecord, listRecords, listRecordsByIndex } from "../services/mockDataService";
import { runAuditedTransaction } from "../services/auditService";

interface OrganizationRecord {
  id: string;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

interface DepartmentRecord {
  id: string;
  organizationId: string;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

interface TeamRecord {
  id: string;
  organizationId: string;
  departmentId: string;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

interface UserReference { id: string; organizationId: string; departmentId: string; teamId: string; roleId: string; role?: string; name?: string; status?: string; financeDepartmentIds?: string[]; [key: string]: unknown; }
interface ExpenseReference { id: string; organizationId: string; departmentId: string; teamId: string; }
interface BudgetReference { id: string; organizationId: string; departmentId?: string; }
interface DepartmentBudgetReference { id: string; organizationId: string; departmentId: string; }

const API_BASE_URL = "/api";

async function roleNamesById(): Promise<Map<string, string>> {
  const roles = await listRecords<{ id: string; name: string }>("roles");
  return new Map(roles.map((role) => [role.id, String(role.name).toLowerCase()]));
}

/** The active manager of a team other than excludeUserId, if any (one manager per team). */
export async function findOtherActiveManager(
  teamId: string,
  excludeUserId?: string,
): Promise<UserReference | undefined> {
  const [members, roleNames] = await Promise.all([
    listRecordsByIndex<UserReference>("users", "teamId", teamId),
    roleNamesById(),
  ]);
  return members.find(
    (member) =>
      member.id !== excludeUserId &&
      member.status === "active" &&
      (roleNames.get(member.roleId) ?? String(member.role ?? "").toLowerCase()) === "manager",
  );
}

function validateName(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return null;
  return name.trim();
}

export const organizationHandlers = [
  http.get(`${API_BASE_URL}/organization`, async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "organization.read",
      scope: "ORGANIZATION",
    });
    if (!authorization.allowed) return authorizationError(authorization);

    const organization = await getRecord<OrganizationRecord>("organizations", authorization.principal.organizationId);
    if (!organization) return apiError(404, "Organization not found.");
    return HttpResponse.json(organization);
  }),

  http.get(`${API_BASE_URL}/departments`, async ({ request }) => {
    const result = await authorizeCollection(request, await listRecords<DepartmentRecord>("departments"), {
      permission: "departments.read",
      scope: "ORGANIZATION",
      getResource: (department) => ({ organizationId: department.organizationId }),
    });
    if (!result.allowed) return authorizationError(result);
    return HttpResponse.json(applyCollectionQuery(result.records, parseCollectionQuery(request)));
  }),

  http.post(`${API_BASE_URL}/departments`, async ({ request }) => {
    const authorization = await authorizeRequest(request, { permission: "departments.manage", scope: "ORGANIZATION" });
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json()) as { name?: string };
    const name = validateName(body.name);
    if (!name) return apiError(400, "Department name is required.");

    const departments = await listRecords<DepartmentRecord>("departments");
    if (departments.some((item) => item.organizationId === authorization.principal.organizationId && item.name.toLowerCase() === name.toLowerCase())) {
      return apiError(409, "A department with this name already exists.");
    }

    const now = new Date().toISOString();
    const department: DepartmentRecord = { id: crypto.randomUUID(), organizationId: authorization.principal.organizationId, name, status: "active", createdAt: now, updatedAt: now };
    await runAuditedTransaction(["departments"], {
      organizationId: department.organizationId, actorId: authorization.principal.userId, action: "DEPARTMENT_CREATED", entityType: "DEPARTMENT", entityId: department.id, newState: "active", description: `Created department ${department.name}.`,
    }, (transaction) => transaction.objectStore("departments").put(department));
    return HttpResponse.json(department, { status: 201 });
  }),

  http.put(`${API_BASE_URL}/departments/:id`, async ({ params, request }) => {
    const departmentId = String(params.id);
    const existing = await getRecord<DepartmentRecord>("departments", departmentId);
    if (!existing) return apiError(404, "Department not found.");
    const authorization = await authorizeRequest(request, { permission: "departments.manage", scope: "ORGANIZATION", resource: { organizationId: existing.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json()) as Partial<DepartmentRecord>;
    const name = validateName(body.name);
    if (!name || (body.status !== "active" && body.status !== "inactive")) return apiError(400, "Enter a department name and a valid status.");
    const departments = await listRecords<DepartmentRecord>("departments");
    if (departments.some((item) => item.id !== existing.id && item.organizationId === existing.organizationId && item.name.toLowerCase() === name.toLowerCase())) {
      return apiError(409, "A department with this name already exists.");
    }
    if (body.status === "inactive" && existing.status !== "inactive") {
      const members = await listRecordsByIndex<UserReference>("users", "departmentId", existing.id);
      const activeMembers = members.filter((member) => member.status !== "inactive").length;
      if (activeMembers > 0) {
        return apiError(409, `${existing.name} still has ${activeMembers} active member(s). Move them to another department before deactivating it.`, "HAS_ACTIVE_MEMBERS");
      }
    }
    const updated = { ...existing, name, status: body.status, updatedAt: new Date().toISOString() };
    await runAuditedTransaction(["departments"], {
      organizationId: existing.organizationId, actorId: authorization.principal.userId, action: "DEPARTMENT_UPDATED", entityType: "DEPARTMENT", entityId: existing.id, metadata: { previousName: existing.name, newName: updated.name, previousStatus: existing.status, newStatus: updated.status }, description: `Updated department ${updated.name}.`,
    }, (transaction) => transaction.objectStore("departments").put(updated));
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_BASE_URL}/departments/:id`, async ({ params, request }) => {
    const departmentId = String(params.id);
    const existing = await getRecord<DepartmentRecord>("departments", departmentId);
    if (!existing) return apiError(404, "Department not found.");
    const authorization = await authorizeRequest(request, { permission: "departments.manage", scope: "ORGANIZATION", resource: { organizationId: existing.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);

    const [teams, users, expenses, budgets, departmentBudgetAllocations, expenseTypeBudgets] = await Promise.all([
      listRecords<TeamRecord>("teams"),
      listRecords<UserReference>("users"),
      listRecords<ExpenseReference>("expenses"),
      listRecords<BudgetReference>("budgets"),
      listRecords<DepartmentBudgetReference>("departmentBudgetAllocations"),
      listRecords<DepartmentBudgetReference>("expenseTypeBudgets"),
    ]);
    if (teams.some((item) => item.departmentId === departmentId) || users.some((item) => item.departmentId === departmentId) || expenses.some((item) => item.departmentId === departmentId) || budgets.some((item) => item.departmentId === departmentId) || departmentBudgetAllocations.some((item) => item.departmentId === departmentId) || expenseTypeBudgets.some((item) => item.departmentId === departmentId)) {
      return apiError(409, "This department cannot be deleted while users, teams, expenses or budgets refer to it. Deactivate it instead.");
    }

    await runAuditedTransaction(["departments"], {
      organizationId: existing.organizationId, actorId: authorization.principal.userId, action: "DEPARTMENT_DELETED", entityType: "DEPARTMENT", entityId: existing.id, previousState: existing.status, newState: "deleted", description: `Deleted department ${existing.name}.`,
    }, (transaction) => transaction.objectStore("departments").delete(departmentId));
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE_URL}/teams`, async ({ request }) => {
    const result = await authorizeCollection(request, await listRecords<TeamRecord>("teams"), {
      permission: "teams.read", scope: "ORGANIZATION", getResource: (team) => ({ organizationId: team.organizationId }),
    });
    if (!result.allowed) return authorizationError(result);
    return HttpResponse.json(applyCollectionQuery(result.records, parseCollectionQuery(request)));
  }),

  http.post(`${API_BASE_URL}/teams`, async ({ request }) => {
    const authorization = await authorizeRequest(request, { permission: "teams.manage", scope: "ORGANIZATION" });
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json()) as { name?: string; departmentId?: string };
    const name = validateName(body.name);
    if (!name || !body.departmentId) return apiError(400, "Team name and department are required.");
    const department = await getRecord<DepartmentRecord>("departments", body.departmentId);
    if (!department || department.organizationId !== authorization.principal.organizationId || department.status !== "active") return apiError(400, "Select an active department from your organization.");
    const teams = await listRecords<TeamRecord>("teams");
    if (teams.some((item) => item.departmentId === department.id && item.name.toLowerCase() === name.toLowerCase())) return apiError(409, "A team with this name already exists in the department.");
    const now = new Date().toISOString();
    const team: TeamRecord = { id: crypto.randomUUID(), organizationId: authorization.principal.organizationId, departmentId: department.id, name, status: "active", createdAt: now, updatedAt: now };
    await runAuditedTransaction(["teams"], {
      organizationId: team.organizationId, actorId: authorization.principal.userId, action: "TEAM_CREATED", entityType: "TEAM", entityId: team.id, newState: "active", metadata: { departmentId: team.departmentId }, description: `Created team ${team.name}.`,
    }, (transaction) => transaction.objectStore("teams").put(team));
    return HttpResponse.json(team, { status: 201 });
  }),

  http.put(`${API_BASE_URL}/teams/:id`, async ({ params, request }) => {
    const teamId = String(params.id);
    const existing = await getRecord<TeamRecord>("teams", teamId);
    if (!existing) return apiError(404, "Team not found.");
    const authorization = await authorizeRequest(request, { permission: "teams.manage", scope: "ORGANIZATION", resource: { organizationId: existing.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json()) as Partial<TeamRecord>;
    const name = validateName(body.name);
    if (!name || !body.departmentId || (body.status !== "active" && body.status !== "inactive")) return apiError(400, "Enter a team name, a department and a valid status.");
    const department = await getRecord<DepartmentRecord>("departments", body.departmentId);
    if (!department || department.organizationId !== existing.organizationId || department.status !== "active") return apiError(400, "Select an active department from your organization.");
    const teams = await listRecords<TeamRecord>("teams");
    if (teams.some((item) => item.id !== existing.id && item.departmentId === department.id && item.name.toLowerCase() === name.toLowerCase())) return apiError(409, "A team with this name already exists in the department.");
    const members = await listRecordsByIndex<UserReference>("users", "teamId", existing.id);
    if (body.status === "inactive" && existing.status !== "inactive") {
      const activeMembers = members.filter((member) => member.status !== "inactive").length;
      if (activeMembers > 0) {
        return apiError(409, `${existing.name} still has ${activeMembers} active member(s). Move them to another team before deactivating it.`, "HAS_ACTIVE_MEMBERS");
      }
    }
    const now = new Date().toISOString();
    const updated = { ...existing, name, departmentId: department.id, status: body.status, updatedAt: now };
    // Members follow their team into its new department (§27.5).
    const movedMembers = existing.departmentId === department.id
      ? []
      : members.map((member) => ({ ...member, departmentId: department.id, updatedAt: now }));
    await runAuditedTransaction(["teams", "users"], {
      organizationId: existing.organizationId, actorId: authorization.principal.userId, action: "TEAM_UPDATED", entityType: "TEAM", entityId: existing.id, metadata: { previousDepartmentId: existing.departmentId, newDepartmentId: updated.departmentId, previousName: existing.name, newName: updated.name, movedMemberIds: movedMembers.map((member) => member.id) }, description: `Updated team ${updated.name}.`,
    }, (transaction) => {
      transaction.objectStore("teams").put(updated);
      for (const member of movedMembers) transaction.objectStore("users").put(member);
    });
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_BASE_URL}/teams/:id`, async ({ params, request }) => {
    const teamId = String(params.id);
    const existing = await getRecord<TeamRecord>("teams", teamId);
    if (!existing) return apiError(404, "Team not found.");
    const authorization = await authorizeRequest(request, { permission: "teams.manage", scope: "ORGANIZATION", resource: { organizationId: existing.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);
    const [users, expenses] = await Promise.all([listRecords<UserReference>("users"), listRecords<ExpenseReference>("expenses")]);
    if (users.some((item) => item.teamId === teamId) || expenses.some((item) => item.teamId === teamId)) return apiError(409, "This team cannot be deleted while users or expenses refer to it. Deactivate it instead.");
    await runAuditedTransaction(["teams"], {
      organizationId: existing.organizationId, actorId: authorization.principal.userId, action: "TEAM_DELETED", entityType: "TEAM", entityId: existing.id, previousState: existing.status, newState: "deleted", description: `Deleted team ${existing.name}.`,
    }, (transaction) => transaction.objectStore("teams").delete(teamId));
    return new HttpResponse(null, { status: 204 });
  }),

  // Moves a user into a team; the user's department follows the team. A user
  // always belongs to exactly one team, so "removing" means moving elsewhere.
  http.post(`${API_BASE_URL}/teams/:id/members`, async ({ params, request }) => {
    const team = await getRecord<TeamRecord>("teams", String(params.id));
    if (!team) return apiError(404, "Team not found.");
    const authorization = await authorizeRequest(request, { permission: "teams.manage", scope: "ORGANIZATION", resource: { organizationId: team.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);
    if (team.status !== "active") return apiError(422, "Users can only be moved into an active team.");

    const body = (await request.json().catch(() => ({}))) as { userId?: unknown };
    const user = typeof body.userId === "string" ? await getRecord<UserReference>("users", body.userId) : undefined;
    if (!user || user.status === "deleted" || user.organizationId !== team.organizationId) return apiError(422, "Select a valid user of this organization.");
    if (user.teamId === team.id) return HttpResponse.json(user);

    const roleName = (await roleNamesById()).get(user.roleId) ?? String(user.role ?? "").toLowerCase();
    if (roleName === "manager" && user.status !== "inactive") {
      const existingManager = await findOtherActiveManager(team.id, user.id);
      if (existingManager) {
        return apiError(409, `${team.name} already has a manager (${existingManager.name ?? existingManager.id}). A team can have only one manager.`, "TEAM_HAS_MANAGER");
      }
    }

    const updated = { ...user, teamId: team.id, departmentId: team.departmentId, updatedAt: new Date().toISOString() };
    await runAuditedTransaction(["users"], {
      organizationId: team.organizationId, actorId: authorization.principal.userId, action: "USER_MEMBERSHIP_CHANGED", entityType: "USER", entityId: user.id,
      metadata: { previousTeamId: user.teamId, newTeamId: team.id, previousDepartmentId: user.departmentId, newDepartmentId: team.departmentId },
      description: `Moved ${user.name ?? user.id} to team ${team.name}.`,
    }, (transaction) => transaction.objectStore("users").put(updated));
    return HttpResponse.json(updated);
  }),

  // Sets which Finance users are authorized for a department (§22.7).
  http.put(`${API_BASE_URL}/departments/:id/finance-users`, async ({ params, request }) => {
    const department = await getRecord<DepartmentRecord>("departments", String(params.id));
    if (!department) return apiError(404, "Department not found.");
    const authorization = await authorizeRequest(request, { permission: "departments.manage", scope: "ORGANIZATION", resource: { organizationId: department.organizationId } });
    if (!authorization.allowed) return authorizationError(authorization);

    const body = (await request.json().catch(() => ({}))) as { userIds?: unknown };
    if (!Array.isArray(body.userIds) || body.userIds.some((id) => typeof id !== "string")) {
      return apiError(422, "Select the Finance users for this department.");
    }
    const selected = new Set(body.userIds as string[]);
    const [users, roleNames] = await Promise.all([listRecords<UserReference>("users"), roleNamesById()]);
    const financeUsers = users.filter((user) =>
      user.organizationId === department.organizationId &&
      user.status !== "deleted" &&
      (roleNames.get(user.roleId) ?? String(user.role ?? "").toLowerCase()) === "finance");
    const financeIds = new Set(financeUsers.map((user) => user.id));
    if ([...selected].some((id) => !financeIds.has(id))) {
      return apiError(422, "Only Finance users can be authorized for a department.");
    }

    const now = new Date().toISOString();
    const changes = financeUsers.flatMap((user) => {
      const current = user.financeDepartmentIds?.length ? user.financeDepartmentIds : [user.departmentId];
      const next = selected.has(user.id)
        ? Array.from(new Set([...current, department.id]))
        : current.filter((id) => id !== department.id);
      if (next.length === current.length && next.every((id) => current.includes(id))) return [];
      const { financeDepartmentIds: _previous, ...rest } = user;
      return [{ previous: current, updated: { ...rest, ...(next.length ? { financeDepartmentIds: next } : {}), updatedAt: now } }];
    });

    if (changes.length) {
      await runAuditedTransaction(["users"], {
        organizationId: department.organizationId, actorId: authorization.principal.userId, action: "USER_MEMBERSHIP_CHANGED", entityType: "DEPARTMENT", entityId: department.id,
        metadata: { financeUsers: changes.map(({ previous, updated }) => ({ userId: updated.id, previousFinanceDepartmentIds: previous, newFinanceDepartmentIds: updated.financeDepartmentIds ?? [] })) },
        description: `Updated Finance authorization for ${department.name}.`,
      }, (transaction) => {
        for (const { updated } of changes) transaction.objectStore("users").put(updated);
      });
    }

    return HttpResponse.json({ departmentId: department.id, financeUserIds: [...selected] });
  }),
];
