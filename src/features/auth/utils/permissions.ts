import type { Permission, User } from "../../../types/auth";

export function hasPermission(
  user: User | null,
  permission: Permission,
): boolean {
  if (!user) {
    return false;
  }

  return user.permissions.includes(permission);
}