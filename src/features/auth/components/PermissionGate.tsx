import type { ReactNode } from "react";

import { usePermissions } from "../hooks/usePermissions";
import type { Permission } from "../../roles/types/role";

interface PermissionGateProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { can } = usePermissions();

  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
