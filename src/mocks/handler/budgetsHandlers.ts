import { http, HttpResponse } from "msw";

import {
  authorizeCollection,
  authorizeRequest,
} from "../services/authorizationService";
import { authorizationError } from "../services/authorizationHttp";

import {
  getRecord,
  listRecords,
  saveRecord,
} from "../services/mockDataService";

interface MockBudget {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  amount: number;
  spentAmount: number;
  currency: "INR";
  department?: string;
  project?: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export const budgetsHandlers = [
  http.get("/api/budgets", async ({ request }) => {
    const result = await authorizeCollection(
      request,
      await listRecords<MockBudget>("budgets"),
      {
        permission: "budgets.read",
        scope: "ORGANIZATION",
        getResource: (budget) => ({ organizationId: budget.organizationId }),
      },
    );

    if (!result.allowed) {
      return authorizationError(result);
    }

    return HttpResponse.json(result.records);
  }),

  http.get("/api/budgets/:id", async ({ params, request }) => {
    const budget = await getRecord<MockBudget>(
      "budgets",
      String(params.id),
    );

    if (!budget) {
      return HttpResponse.json(
        { message: "Budget not found." },
        { status: 404 },
      );
    }

    const authorization = await authorizeRequest(request, {
      permission: "budgets.read",
      scope: "ORGANIZATION",
      resource: { organizationId: budget.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    return HttpResponse.json(budget);
  }),

  http.post("/api/budgets", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "budgets.create",
      scope: "ORGANIZATION",
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }
    const body = (await request.json()) as {
      name: string;
      description?: string;
      amount: number;
      department?: string;
      project?: string;
      startDate: string;
      endDate: string;
    };

    const now = new Date().toISOString();

    const newBudget: MockBudget = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      name: body.name,
      description: body.description,
      amount: body.amount,
      spentAmount: 0,
      currency: "INR",
      department: body.department,
      project: body.project,
      startDate: body.startDate,
      endDate: body.endDate,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    await saveRecord("budgets", newBudget);

    return HttpResponse.json(newBudget, { status: 201 });
  }),

  http.put(
    "/api/budgets/:id",
    async ({ params, request }) => {
      const budgetId = String(params.id);
      const existingBudget = await getRecord<MockBudget>(
        "budgets",
        budgetId,
      );

      if (!existingBudget) {
        return HttpResponse.json(
          { message: "Budget not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "budgets.update",
        scope: "ORGANIZATION",
        resource: { organizationId: existingBudget.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      const body = (await request.json()) as {
        name: string;
        description?: string;
        amount: number;
        department?: string;
        project?: string;
        startDate: string;
        endDate: string;
      };

      const updatedBudget: MockBudget = {
        ...existingBudget,
        name: body.name,
        description: body.description,
        amount: body.amount,
        department: body.department,
        project: body.project,
        startDate: body.startDate,
        endDate: body.endDate,
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("budgets", updatedBudget);

      return HttpResponse.json(updatedBudget);
    },
  ),
];
