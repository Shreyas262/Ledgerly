import { HttpResponse } from "msw";
import type { AuthorizationResult } from "./authorizationService";

export function authorizationError(
  result: Exclude<AuthorizationResult, { allowed: true }>,
) {
  return HttpResponse.json(
    {
      message: result.message,
      code: result.code,
    },
    { status: result.status },
  );
}
