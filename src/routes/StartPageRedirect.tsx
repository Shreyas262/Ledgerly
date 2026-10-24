import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/hooks/useAuth";
import { usePermissions } from "../features/auth/hooks/usePermissions";
import { HOME_PATH, isPersonalAccount, isPlatformAccount } from "../features/auth/utils/accountType";
import { useSettings } from "../features/settings/hooks/useSettings";
import { approvalPermissions } from "../features/roles/constants/permissions";

/** Sends the user to their chosen start page (§30.12), when they can open it. */
export function StartPageRedirect() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { can, canAny } = usePermissions();

  // Platform operators have a single area and no start page choice.
  if (isPlatformAccount(user)) {
    return <Navigate to={HOME_PATH.platform} replace />;
  }

  if (isPersonalAccount(user)) {
    const allowed = settings.startPage === "/personal/dashboard" || settings.startPage === "/personal/expenses";
    return <Navigate to={allowed ? settings.startPage : HOME_PATH.personal} replace />;
  }

  const allowed =
    settings.startPage === "/dashboard" ||
    (settings.startPage === "/expenses" && can("expenses.read")) ||
    (settings.startPage === "/approvals" && canAny(approvalPermissions));
  return <Navigate to={allowed ? settings.startPage : HOME_PATH.organization} replace />;
}
