import { useAuth } from "../hooks/useAuth";
import { hasPermission } from "../utils/permissions";
import type { Permission } from "../../roles/types/role";

export function usePermissions() {
  const { user } = useAuth();

  function can(permission: Permission): boolean {
    return hasPermission(user, permission);
  }

  /** A single permission, or any one of a list. */
  function canAny(permission: Permission | readonly Permission[]): boolean {
    return typeof permission === "string" ? can(permission) : permission.some(can);
  }

  return {
    can,
    canAny,
  };
}
