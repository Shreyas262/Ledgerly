
import type { AuthSession, User } from "./auth"

export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
}

export interface ApiError {
  message: string;
  code: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: AuthSession;
}

export interface GetCurrentUserResponse {
  data: User;
}