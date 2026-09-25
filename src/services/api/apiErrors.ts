import type { ApiError } from "../../types/api";

export interface ApiErrorDetails {
  fieldErrors?: Record<string, string | string[]>;
  businessRule?: string;
  allowedStates?: string[];
  conflictingResource?: Record<string, unknown>;
  availableAmount?: number;
  requestedAmount?: number;
  [key: string]: unknown;
}

export function isApiError(error: unknown): error is ApiError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      "message" in error,
  );
}

export function getApiError(error: unknown): ApiError | null {
  if (isApiError(error)) return error;
  if (!error || typeof error !== "object") return null;

  const candidate = error as { data?: unknown; error?: unknown };
  if (isApiError(candidate.data)) return candidate.data;
  if (isApiError(candidate.error)) return candidate.error;
  return null;
}

export function getApiErrorDetails(error: unknown): ApiErrorDetails {
  const apiError = getApiError(error);
  return apiError?.details && typeof apiError.details === "object"
    ? (apiError.details as ApiErrorDetails)
    : {};
}

export function getFieldError(error: unknown, field: string): string | undefined {
  const value = getApiErrorDetails(error).fieldErrors?.[field];
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "The request could not be completed.",
): string {
  return getApiError(error)?.message ?? fallback;
}

export function isStatus(error: unknown, status: number): boolean {
  return getApiError(error)?.status === status;
}
