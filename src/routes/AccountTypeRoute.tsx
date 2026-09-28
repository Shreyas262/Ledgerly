import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../features/auth/context/AuthContext";
import type { AccountType } from "../features/auth/types/auth";
import { HOME_PATH, accountTypeOf } from "../features/auth/utils/accountType";

interface AccountTypeRouteProps {
  accountType: AccountType;
}

/**
 * Keeps each kind of account inside its own area (§5.15): personal accounts
 * never reach organization pages and organization accounts never reach
 * personal pages. Users are sent to their own home instead.
 */
export function AccountTypeRoute({ accountType }: AccountTypeRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const actual = accountTypeOf(user);
  if (actual !== accountType) {
    return <Navigate to={HOME_PATH[actual]} replace />;
  }

  return <Outlet />;
}
