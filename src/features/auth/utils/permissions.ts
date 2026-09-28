import type { Permission } from "../../roles/types/role";
import type { AuthUser } from "../types/auth";

export function hasPermission(
  user: AuthUser | null,
  permission: Permission,
): boolean {
  if (!user) {
    return false;
  }

  return user.permissions.includes(permission);
}