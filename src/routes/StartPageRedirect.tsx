import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/context/AuthContext";
import { usePermissions } from "../features/auth/hooks/usePermissions";
import { HOME_PATH, isPersonalAccount } from "../features/auth/utils/accountType";
import { useSettings } from "../features/settings/hooks/useSettings";

/** Sends the user to their chosen start page (§30.12), when they can open it. */
export function StartPageRedirect() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { can } = usePermissions();

  if (isPersonalAccount(user)) {
    const allowed = settings.startPage === "/personal/dashboard" || settings.startPage === "/personal/expenses";
    return <Navigate to={allowed ? settings.startPage : HOME_PATH.personal} replace />;
  }

  const allowed =
    settings.startPage === "/dashboard" ||
    (settings.startPage === "/expenses" && can("expenses.read")) ||
    (settings.startPage === "/approvals" && (can("expenses.approve") || can("reimbursements.manage")));
  return <Navigate to={allowed ? settings.startPage : HOME_PATH.organization} replace />;
}
