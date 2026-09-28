import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "../components/common/LoadingState";
import { useAuth } from "../features/auth/context/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return <LoadingState message="Checking your session…" />;
  }

  if (!isAuthenticated) {
    // Personal pages lead back to the personal sign-in.
    const personal = location.pathname.startsWith("/personal");
    return (
      <Navigate
        to={personal ? "/auth/login?type=personal" : "/auth/login"}
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  return <Outlet />;
}
