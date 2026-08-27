import type { User } from "../../../types/auth";
import type { Permission } from "../../../types/permissions";

export function hasPermission(
  user: User | null,
  permission: Permission,
): boolean {
  if (!user) {
    return false;
  }

  return user.permissions.includes(permission);
}