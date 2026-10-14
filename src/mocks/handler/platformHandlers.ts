import { http, HttpResponse } from "msw";

import { apiError } from "../services/apiError";
import { resolveAuthenticatedPrincipal } from "../services/authorizationService";
import { listRecords } from "../services/mockDataService";
import { runAuditedTransaction } from "../services/auditService";
import { hashPassword } from "../services/passwordService";
import { bootstrapRoles } from "../data/bootstrap";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";

const API_BASE_URL = "/api";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const DEFAULT_UNIT_NAME = "General";

interface OrganizationRecord {
  id: string;
  name: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

interface UserRecord {
  id: string;
  accountType?: string;
  organizationId: string;
  roleId: string;
  name: string;
  email: string;
  status: "active" | "inactive" | "deleted";
}

interface RoleRecord {
  id: string;
  organizationId: string;
  name: string;
}

/**
 * Platform endpoints serve platform operators only. Operators hold no
 * organization permissions, so the account type is the authority here.
 */
async function authorizePlatform(
  request: Request,
): Promise<{ principal: AuthenticatedPrincipal } | { error: Response }> {
  const principal = await resolveAuthenticatedPrincipal(request);
  if (!principal) return { error: apiError(401, "Please sign in to continue.") };
  if (principal.accountType !== "platform") {
    return { error: apiError(403, "Only platform operators can manage organizations.") };
  }
  return { principal };
}

export const platformHandlers = [
  // Every organization, with its size and Admins.
  http.get(`${API_BASE_URL}/platform/organizations`, async ({ request }) => {
    const authorization = await authorizePlatform(request);
    if ("error" in authorization) return authorization.error;

    const [organizations, users, roles] = await Promise.all([
      listRecords<OrganizationRecord>("organizations"),
      listRecords<UserRecord>("users"),
      listRecords<RoleRecord>("roles"),
    ]);
    const adminRoleIds = new Set(roles.filter((role) => role.name === "admin").map((role) => role.id));

    return HttpResponse.json(
      organizations
        .map((organization) => {
          const members = users.filter((user) => user.organizationId === organization.id && user.status !== "deleted");
          return {
            ...organization,
            userCount: members.length,
            admins: members
              .filter((user) => adminRoleIds.has(user.roleId))
              .map((user) => ({ id: user.id, name: user.name, email: user.email })),
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }),

  // Creates an organization with its system roles, a default department and
  // team, and its first Admin, in one audited transaction.
  http.post(`${API_BASE_URL}/platform/organizations`, async ({ request }) => {
    const authorization = await authorizePlatform(request);
    if ("error" in authorization) return authorization.error;

    const body = (await request.json().catch(() => ({}))) as {
      name?: unknown;
      admin?: { name?: unknown; email?: unknown; password?: unknown };
    };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const adminName = typeof body.admin?.name === "string" ? body.admin.name.trim() : "";
    const adminEmail = typeof body.admin?.email === "string" ? body.admin.email.trim() : "";
    const adminPassword = typeof body.admin?.password === "string" ? body.admin.password : "";

    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.name = "Organization name is required.";
    if (!adminName) fieldErrors.adminName = "Admin name is required.";
    if (!EMAIL_PATTERN.test(adminEmail)) fieldErrors.adminEmail = "A valid email address is required.";
    if (adminPassword.length < MIN_PASSWORD_LENGTH) fieldErrors.adminPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (Object.keys(fieldErrors).length) {
      return apiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fieldErrors });
    }

    const [organizations, users] = await Promise.all([
      listRecords<OrganizationRecord>("organizations"),
      listRecords<UserRecord>("users"),
    ]);
    if (organizations.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      return apiError(409, "An organization with this name already exists.", "CONFLICT", {
        fieldErrors: { name: "An organization with this name already exists." },
      });
    }
    // Removed users' emails may be reused, as in user management.
    if (users.some((user) => user.status !== "deleted" && user.email.toLowerCase() === adminEmail.toLowerCase())) {
      return apiError(409, "An account with this email already exists.", "CONFLICT", {
        fieldErrors: { adminEmail: "An account with this email already exists." },
      });
    }

    const now = new Date().toISOString();
    const organization: OrganizationRecord = { id: crypto.randomUUID(), name, status: "active", createdAt: now, updatedAt: now };
    const roles = bootstrapRoles.map((role) => ({
      ...role,
      permissions: [...role.permissions],
      id: crypto.randomUUID(),
      organizationId: organization.id,
      createdAt: now,
      updatedAt: now,
    }));
    const adminRole = roles.find((role) => role.name === "admin")!;
    const department = { id: crypto.randomUUID(), organizationId: organization.id, name: DEFAULT_UNIT_NAME, status: "active", createdAt: now, updatedAt: now };
    const team = { id: crypto.randomUUID(), organizationId: organization.id, departmentId: department.id, name: DEFAULT_UNIT_NAME, status: "active", createdAt: now, updatedAt: now };
    const admin = {
      id: crypto.randomUUID(),
      accountType: "organization",
      organizationId: organization.id,
      departmentId: department.id,
      teamId: team.id,
      roleId: adminRole.id,
      name: adminName,
      email: adminEmail,
      role: adminRole.name,
      permissions: adminRole.permissions,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const credential = { userId: admin.id, email: adminEmail, password: await hashPassword(adminPassword) };

    await runAuditedTransaction(
      ["organizations", "roles", "departments", "teams", "users", "credentials"],
      {
        organizationId: organization.id,
        actorId: authorization.principal.userId,
        action: "ORGANIZATION_CREATED",
        entityType: "ORGANIZATION",
        entityId: organization.id,
        newState: "active",
        metadata: { adminId: admin.id, departmentId: department.id, teamId: team.id, roleIds: roles.map((role) => role.id) },
        description: `Created organization ${organization.name} with ${admin.name} as Admin.`,
      },
      (transaction) => {
        transaction.objectStore("organizations").put(organization);
        for (const role of roles) transaction.objectStore("roles").put(role);
        transaction.objectStore("departments").put(department);
        transaction.objectStore("teams").put(team);
        transaction.objectStore("users").put(admin);
        transaction.objectStore("credentials").put(credential);
      },
    );

    return HttpResponse.json(
      { ...organization, userCount: 1, admins: [{ id: admin.id, name: admin.name, email: admin.email }] },
      { status: 201 },
    );
  }),
];
