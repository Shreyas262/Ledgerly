import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "../components/common/LoadingState";
import { useAuth } from "../features/auth/context/AuthContext";

export function ProtectedRoute() {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth();

  const location = useLocation();

  if (isLoading) {
    return (
      <LoadingState message="Checking your session..." />
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  return <Outlet />;
}