import type { AccountType, AuthUser } from "../types/auth";

/** Users created before personal accounts existed are organization users. */
export function accountTypeOf(user: AuthUser | null | undefined): AccountType {
  return user?.accountType ?? "organization";
}

export const isPersonalAccount = (user: AuthUser | null | undefined): boolean =>
  accountTypeOf(user) === "personal";

/** Where each kind of account lands by default. */
export const HOME_PATH: Record<AccountType, string> = {
  organization: "/dashboard",
  personal: "/personal/dashboard",
};
