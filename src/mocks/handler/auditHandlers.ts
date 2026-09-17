import { http, HttpResponse } from "msw";

import { auditLogs } from "../data/auditLogs";

const API_BASE_URL = "/api";

export const auditHandlers = [
  http.get(`${API_BASE_URL}/audit-logs`, () => {
    return HttpResponse.json({
      data: auditLogs,
    });
  }),

  http.get(
    `${API_BASE_URL}/audit-logs/:id`,
    ({ params }) => {
      const auditLog = auditLogs.find(
        (item) => item.id === params.id,
      );

      if (!auditLog) {
        return HttpResponse.json(
          {
            message: "Audit log not found.",
          },
          {
            status: 404,
          },
        );
      }

      return HttpResponse.json({
        data: auditLog,
      });
    },
  ),
];