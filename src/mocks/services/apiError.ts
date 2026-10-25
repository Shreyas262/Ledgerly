import { HttpResponse } from "msw";
import { WorkflowError } from "./workflowErrors";

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

/** The response for an operation a service refused; unexpected failures never expose internal messages. */
export function workflowErrorResponse(error: unknown) {
  if (error instanceof WorkflowError) {
    return apiError(error.status, error.message, error.code, error.details);
  }
  return apiError(500, "The action could not be completed.");
}
