import type { AuthorizationResult } from "./authorizationService";
import { apiError } from "./apiError";

export function authorizationError(result: AuthorizationResult) {
  if (result.allowed) {
    throw new Error("authorizationError requires a failed authorization result.");
  }

  const failure = result as Extract<AuthorizationResult, { allowed: false }>;
  return apiError(failure.status, failure.message, failure.code);
}
