import { http, HttpResponse } from "msw";

import type { CreateDelegationRequest, Delegation } from "../../features/approvals/types/delegation";
import { apiError, workflowErrorResponse } from "../services/apiError";
import { authorizeRequest } from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import {
  cancelDelegation,
  createDelegation,
  getDelegationCandidates,
  getDelegatorRestriction,
  listDelegations,
} from "../services/delegationService";
import { getRecord } from "../services/mockDataService";

/** Review delegation is for reviewers: the review permission is the authority (§22.12). */
function authorizeReviewer(request: Request) {
  return authorizeRequest(request, { permission: "expenses.approve", scope: "ORGANIZATION" });
}

export const delegationHandlers = [
  http.get("/api/delegations", async ({ request }) => {
    const authorization = await authorizeReviewer(request);
    if (!authorization.allowed) return authorizationError(authorization);
    return HttpResponse.json(await listDelegations(authorization.principal));
  }),

  http.get("/api/delegations/candidates", async ({ request }) => {
    const authorization = await authorizeReviewer(request);
    if (!authorization.allowed) return authorizationError(authorization);
    const restriction = getDelegatorRestriction(authorization.principal);
    if (restriction) return apiError(403, restriction);
    return HttpResponse.json(await getDelegationCandidates(authorization.principal));
  }),

  http.post("/api/delegations", async ({ request }) => {
    const authorization = await authorizeReviewer(request);
    if (!authorization.allowed) return authorizationError(authorization);
    const body = (await request.json().catch(() => ({}))) as Partial<CreateDelegationRequest>;
    try {
      return HttpResponse.json(await createDelegation(authorization.principal, body), { status: 201 });
    } catch (error) {
      return workflowErrorResponse(error);
    }
  }),

  http.post("/api/delegations/:id/cancel", async ({ params, request }) => {
    const authorization = await authorizeReviewer(request);
    if (!authorization.allowed) return authorizationError(authorization);
    const { principal } = authorization;

    // Only the two people involved learn that a delegation exists.
    const delegation = await getRecord<Delegation>("delegations", String(params.id));
    if (
      !delegation ||
      delegation.organizationId !== principal.organizationId ||
      (delegation.delegatorId !== principal.userId && delegation.delegateId !== principal.userId)
    ) {
      return apiError(404, "Delegation not found.");
    }

    try {
      return HttpResponse.json(await cancelDelegation(principal, delegation));
    } catch (error) {
      return workflowErrorResponse(error);
    }
  }),
];
