import {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";

import { useGetCurrentUserQuery } from "../api/authApi";
import type { User } from "../../../types/auth";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refetchUser: ReturnType<typeof useGetCurrentUserQuery>["refetch"],
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: PropsWithChildren) {
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCurrentUserQuery();

  const user = data?.data ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !isError && user !== null,
        isLoading: isLoading || isFetching,
        refetchUser: refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider",
    );
  }

  return context;
}