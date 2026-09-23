import type { Permission } from "../../features/roles/types/role";
import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import { getRecord } from "./mockDataService";
import { resolveSession } from "./sessionService";
import { getSessionCookieHeader } from "../sessionCookie";

export type AuthorizationScope =
  | "OWN"
  | "TEAM"
  | "DEPARTMENT"
  | "ORGANIZATION";

export interface AuthorizationResource {
  organizationId: string;
  ownerId?: string;
  teamId?: string;
  departmentId?: string;
  state?: string;
}

export interface AuthorizationOptions {
  permission: Permission;
  scope: AuthorizationScope;
  resource?: AuthorizationResource;
  allowedStates?: readonly string[];
  domainRule?: (
    principal: AuthenticatedPrincipal,
    resource: AuthorizationResource,
  ) => boolean;
}

interface AuthorizationUser {
  id: string;
  organizationId: string;
  departmentId: string;
  teamId: string;
  roleId: string;
  role?: string;
  permissions?: string[];
}

interface AuthorizationRole {
  id: string;
  organizationId: string;
  permissions: string[];
}

export type AuthorizationResult =
  | { allowed: true; principal: AuthenticatedPrincipal }
  | {
      allowed: false;
      status: 401 | 403;
      code: "UNAUTHENTICATED" | "FORBIDDEN";
      message: string;
    };

export async function buildAuthenticatedPrincipal(
  user: AuthorizationUser,
): Promise<AuthenticatedPrincipal | null>
{
  const role = await getRecord<AuthorizationRole>("roles", user.roleId);

  if (!role || role.organizationId !== user.organizationId) {
    return null;
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    departmentId: user.departmentId,
    teamId: user.teamId,
    roleId: user.roleId,
    role: user.role ?? "",
    effectivePermissions: role.permissions as Permission[],
  };
}

export async function resolveAuthenticatedPrincipal(
  request: Request,
): Promise<AuthenticatedPrincipal | null> {
  const sessionId = getSessionCookieHeader(request);

  if (!sessionId) {
    return null;
  }

  const session = await resolveSession(sessionId);

  if (!session) {
    return null;
  }

  const user = await getRecord<AuthorizationUser>(
    "users",
    session.userId,
  );

  if (!user) {
    return null;
  }

  return buildAuthenticatedPrincipal(user);
}

export async function authorizeRequest(
  request: Request,
  options: AuthorizationOptions,
): Promise<AuthorizationResult> {
  const principal = await resolveAuthenticatedPrincipal(request);

  if (!principal) {
    return {
      allowed: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication required.",
    };
  }

  if (!principal.effectivePermissions.includes(options.permission)) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      message: "You are not authorized to perform this operation.",
    };
  }

  if (!options.resource) {
    return { allowed: true, principal };
  }

  if (options.resource.organizationId !== principal.organizationId) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      message: "You are not authorized to access this organization resource.",
    };
  }

  if (!isWithinScope(principal, options.resource, options.scope)) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      message: "You are not authorized to access this resource scope.",
    };
  }

  if (
    options.allowedStates &&
    options.resource.state &&
    !options.allowedStates.includes(options.resource.state)
  ) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      message: "You are not authorized to operate on this resource state.",
    };
  }

  if (
    options.domainRule &&
    !options.domainRule(principal, options.resource)
  ) {
    return {
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      message: "You are not authorized to perform this domain operation.",
    };
  }

  return { allowed: true, principal };
}

export function isWithinScope(
  principal: AuthenticatedPrincipal,
  resource: AuthorizationResource,
  scope: AuthorizationScope,
): boolean {
  if (resource.organizationId !== principal.organizationId) {
    return false;
  }

  switch (scope) {
    case "OWN":
      return resource.ownerId === principal.userId;
    case "TEAM":
      return resource.teamId === principal.teamId;
    case "DEPARTMENT":
      return resource.departmentId === principal.departmentId;
    case "ORGANIZATION":
      return true;
    default:
      return false;
  }
}

export async function authorizeCollection<T>(
  request: Request,
  records: T[],
  options: Omit<AuthorizationOptions, "resource"> & {
    getResource: (record: T) => AuthorizationResource;
  },
): Promise<
  | { allowed: true; principal: AuthenticatedPrincipal; records: T[] }
  | Exclude<AuthorizationResult, { allowed: true }>
> {
  const result = await authorizeRequest(request, {
    permission: options.permission,
    scope: options.scope,
  });

  if (!result.allowed) {
    return result;
  }

  const authorizedRecords = records.filter((record) =>
    isWithinScope(result.principal, options.getResource(record), options.scope),
  );

  return {
    allowed: true,
    principal: result.principal,
    records: authorizedRecords,
  };
}

