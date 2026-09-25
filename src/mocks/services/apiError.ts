import { HttpResponse } from "msw";

const DEFAULT_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  500: "INTERNAL_ERROR",
};

export function apiError(
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500,
  message: string,
  code = DEFAULT_CODES[status],
  details?: Record<string, unknown>,
) {
  return HttpResponse.json(
    { status, code, message, ...(details ? { details } : {}) },
    { status },
  );
}
