import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../features/auth/context/AuthContext";
import { hasPermission } from "../features/auth/utils/permissions";
import { ForbiddenPage } from "../features/auth/pages/ForbiddenPage";
import type { Permission } from "../types/permissions";

interface PermissionRouteProps {
  permission: Permission;
}

export function PermissionRoute({
  permission,
}: PermissionRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(user, permission)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}