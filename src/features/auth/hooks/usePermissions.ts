import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../utils/permissions";
import type { Permission } from "../../../types/auth";

export function usePermissions() {
  const { user } = useAuth();

  function can(permission: Permission): boolean {
    return hasPermission(user, permission);
  }

  return {
    can,
  };
}