import { http, HttpResponse } from "msw";

import {
  authorizeCollection,
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";

import {
  getRecord,
  listRecords,
} from "../services/mockDataService";

export const auditHandlers = [
  http.get("/api/audit-logs", async ({ request }) => {
    const result = await authorizeCollection(
      request,
      await listRecords<{ organizationId: string }>("auditEvents"),
      {
        permission: "audit.read",
        scope: "ORGANIZATION",
        getResource: (event) => ({ organizationId: event.organizationId }),
      },
    );

    if (!result.allowed) {
      return authorizationError(result);
    }

    return HttpResponse.json({ data: result.records });
  }),

  http.get("/api/audit-logs/:id", async ({ params, request }) => {
    const auditLog = await getRecord(
      "auditEvents",
      String(params.id),
    );

    if (!auditLog) {
      return HttpResponse.json(
        { message: "Audit log not found." },
        { status: 404 },
      );
    }

    const authorization = await authorizeRequest(request, {
      permission: "audit.read",
      scope: "ORGANIZATION",
      resource: { organizationId: String((auditLog as { organizationId?: string }).organizationId ?? "") },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    return HttpResponse.json({
      data: auditLog,
    });
  }),
];
