import { applyCollectionQueryResult, parseCollectionQuery } from "../../services/api/queryParams";
import { http, HttpResponse } from "msw";

import type { AuditEvent } from "../../features/audit/types/audit";
import type { UserActivity } from "../../features/activity/types/activity";
import {
  authorizeCollection,
  authorizeRequest,
  resolveAuthenticatedPrincipal,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";
import { apiError } from "../services/apiError";
import { getRecord, listRecords, listRecordsByIndex } from "../services/mockDataService";

export const auditHandlers = [
  // §24: User Activity is a current-user projection of authoritative audit
  // events. It requires authentication only and never exposes other actors.
  http.get("/api/activity", async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);

    if (!principal) {
      return apiError(401, "Authentication required.");
    }

    const events = await listRecordsByIndex<AuditEvent>(
      "auditEvents",
      "actorId",
      principal.userId,
    );

    const activity: UserActivity[] = events
      .filter((event) => event.organizationId === principal.organizationId)
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
      )
      .map((event) => ({
        id: event.id,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        timestamp: event.timestamp,
        ...(event.previousState ? { previousState: event.previousState } : {}),
        ...(event.newState ? { newState: event.newState } : {}),
        ...(event.description ? { description: event.description } : {}),
      }));

    return HttpResponse.json(applyCollectionQueryResult(activity, parseCollectionQuery(request)));
  }),

  http.get("/api/audit-logs", async ({ request }) => {
    const result = await authorizeCollection(
      request,
      await listRecords<AuditEvent>("auditEvents"),
      {
        permission: "audit.read",
        scope: "ORGANIZATION",
        getResource: (event) => ({ organizationId: event.organizationId }),
      },
    );

    if (!result.allowed) {
      return authorizationError(result);
    }

    const records = [...result.records].sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );

    return HttpResponse.json(applyCollectionQueryResult(records, parseCollectionQuery(request)));
  }),

  http.get("/api/audit-logs/:id", async ({ params, request }) => {
    const auditEvent = await getRecord<AuditEvent>(
      "auditEvents",
      String(params.id),
    );

    if (!auditEvent) {
      return HttpResponse.json(
        { message: "Audit event not found." },
        { status: 404 },
      );
    }

    const authorization = await authorizeRequest(request, {
      permission: "audit.read",
      scope: "ORGANIZATION",
      resource: { organizationId: auditEvent.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    return HttpResponse.json({ data: auditEvent });
  }),
];
