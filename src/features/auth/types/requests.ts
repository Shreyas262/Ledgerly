import type { AccountType } from "./auth";

export interface LoginRequest {
  email: string;
  password: string;
  /** The sign-in path used; the account must be of this type. */
  accountType?: AccountType;
}

export interface RegisterPersonalRequest {
  name: string;
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  name: string;
  email: string;
}
