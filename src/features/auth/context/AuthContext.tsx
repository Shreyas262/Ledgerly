import type { PropsWithChildren } from "react";

import { useGetCurrentUserQuery } from "../api/authApi";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }: PropsWithChildren) {
  const { data, isLoading, isFetching, isSuccess, isError, refetch } =
    useGetCurrentUserQuery();

  const user = data?.data ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !isError && user !== null,
        // Refreshing a known user (e.g. after a profile update) keeps the app
        // mounted; only an unconfirmed session counts as loading.
        isLoading: isLoading || (isFetching && !isSuccess),
        refetchUser: refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
