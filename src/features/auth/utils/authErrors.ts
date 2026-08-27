export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("status" in error) {
    return error.status === 401;
  }

  return false;
}