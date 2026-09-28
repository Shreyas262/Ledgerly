import { Navigate } from "react-router-dom";
import { usePermissions } from "../features/auth/hooks/usePermissions";
import { useSettings } from "../features/settings/hooks/useSettings";

/** Sends "/" to the user's chosen start page (§30.12), when they can open it. */
export function StartPageRedirect() {
  const { settings } = useSettings();
  const { can } = usePermissions();
  const allowed =
    settings.startPage === "/dashboard" ||
    (settings.startPage === "/expenses" && can("expenses.read")) ||
    (settings.startPage === "/approvals" && (can("expenses.approve") || can("reimbursements.manage")));
  return <Navigate to={allowed ? settings.startPage : "/dashboard"} replace />;
}
