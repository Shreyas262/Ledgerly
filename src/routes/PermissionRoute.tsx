import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../features/auth/context/AuthContext";
import { usePermissions } from "../features/auth/hooks/usePermissions";
import type { Permission } from "../features/roles/types/role";
import { ForbiddenPage } from "../features/auth/pages/ForbiddenPage";

interface PermissionRouteProps {
  /** A single permission, or a list of which the user needs any one. */
  permission: Permission | readonly Permission[];
}

export function PermissionRoute({ permission }: PermissionRouteProps) {
  const { user, isLoading } = useAuth();
  const { can } = usePermissions();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const permissions: readonly Permission[] = Array.isArray(permission)
    ? permission
    : [permission as Permission];

  if (!permissions.some((item) => can(item))) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}
