import { createContext } from "react";

import type { useGetCurrentUserQuery } from "../api/authApi";
import type { AuthUser } from "../types/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refetchUser: ReturnType<typeof useGetCurrentUserQuery>["refetch"];
}

/** Shared by AuthProvider, which supplies it, and useAuth, which reads it. */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
