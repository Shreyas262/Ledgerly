export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("status" in error) {
    return error.status === 401;
  }

  return false;
}

export function isForbiddenError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return "status" in error && error.status === 403;
}
