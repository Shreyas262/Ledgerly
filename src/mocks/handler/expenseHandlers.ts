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

interface MockExpense {
  id: string;
  organizationId: string;
  employeeId: string;
  title: string;
  description: string;
  amount: number;
  currency: "INR";
  category: string;
  status: string;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  [key: string]: unknown;
}

export const expensesHandlers = [
  http.get("/api/expenses", async ({ request }) => {
    const result = await authorizeCollection(
      request,
      await listRecords<MockExpense>("expenses"),
      {
        permission: "expenses.read",
        scope: "ORGANIZATION",
        getResource: (expense) => ({
          organizationId: expense.organizationId,
        }),
      },
    );

    if (!result.allowed) {
      return authorizationError(result);
    }

    return HttpResponse.json(result.records);
  }),

  http.get("/api/expenses/:id", async ({ params, request }) => {
    const expense = await getRecord<MockExpense>(
      "expenses",
      String(params.id),
    );

    if (!expense) {
      return HttpResponse.json(
        { message: "Expense not found." },
        { status: 404 },
      );
    }

    const authorization = await authorizeRequest(request, {
      permission: "expenses.read",
      scope: "ORGANIZATION",
      resource: { organizationId: expense.organizationId },
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    return HttpResponse.json(expense);
  }),

  http.post("/api/expenses", async ({ request }) => {
    const authorization = await authorizeRequest(request, {
      permission: "expenses.create",
      scope: "ORGANIZATION",
    });

    if (!authorization.allowed) {
      return authorizationError(authorization);
    }

    const body = (await request.json()) as {
      title: string;
      description: string;
      amount: number;
      category: string;
      expenseDate: string;
    };

    const now = new Date().toISOString();

    const newExpense: MockExpense = {
      id: crypto.randomUUID(),
      organizationId: authorization.principal.organizationId,
      employeeId: authorization.principal.userId,
      title: body.title,
      description: body.description,
      amount: body.amount,
      currency: "INR",
      category: body.category,
      expenseDate: body.expenseDate,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };

    await saveRecord("expenses", newExpense);

    return HttpResponse.json(newExpense, { status: 201 });
  }),

  http.put(
    "/api/expenses/:id",
    async ({ params, request }) => {
      const expenseId = String(params.id);
      const existingExpense = await getRecord<MockExpense>(
        "expenses",
        expenseId,
      );

      if (!existingExpense) {
        return HttpResponse.json(
          { message: "Expense not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "expenses.update",
        scope: "ORGANIZATION",
        resource: { organizationId: existingExpense.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      if (existingExpense.status !== "draft") {
        return HttpResponse.json(
          { message: "Only draft expenses can be edited." },
          { status: 409 },
        );
      }

      const body = (await request.json()) as {
        title: string;
        description: string;
        amount: number;
        category: string;
        expenseDate: string;
      };

      const updatedExpense: MockExpense = {
        ...existingExpense,
        ...body,
        currency: "INR",
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("expenses", updatedExpense);

      return HttpResponse.json(updatedExpense);
    },
  ),

  http.post(
    "/api/expenses/:id/submit",
    async ({ params, request }) => {
      const expenseId = String(params.id);
      const expense = await getRecord<MockExpense>(
        "expenses",
        expenseId,
      );

      if (!expense) {
        return HttpResponse.json(
          { message: "Expense not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "expenses.submit",
        scope: "ORGANIZATION",
        resource: { organizationId: expense.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      if (expense.status !== "draft") {
        return HttpResponse.json(
          { message: "Only draft expenses can be submitted." },
          { status: 409 },
        );
      }

      const updatedExpense = {
        ...expense,
        status: "submitted",
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("expenses", updatedExpense);

      return HttpResponse.json(updatedExpense);
    },
  ),

  http.post(
    "/api/expenses/:id/review",
    async ({ params, request }) => {
      const expenseId = String(params.id);
      const expense = await getRecord<MockExpense>(
        "expenses",
        expenseId,
      );

      if (!expense) {
        return HttpResponse.json(
          { message: "Expense not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "expenses.approve",
        scope: "ORGANIZATION",
        resource: { organizationId: expense.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      if (expense.status !== "submitted") {
        return HttpResponse.json(
          {
            message:
              "Only submitted expenses can enter review.",
          },
          { status: 409 },
        );
      }

      const updatedExpense = {
        ...expense,
        status: "under_review",
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("expenses", updatedExpense);

      return HttpResponse.json(updatedExpense);
    },
  ),

  http.post(
    "/api/expenses/:id/approve",
    async ({ params, request }) => {
      const expenseId = String(params.id);
      const expense = await getRecord<MockExpense>(
        "expenses",
        expenseId,
      );

      if (!expense) {
        return HttpResponse.json(
          { message: "Expense not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "expenses.approve",
        scope: "ORGANIZATION",
        resource: { organizationId: expense.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      if (expense.status !== "under_review") {
        return HttpResponse.json(
          {
            message:
              "Only expenses under review can be approved.",
          },
          { status: 409 },
        );
      }

      const updatedExpense = {
        ...expense,
        status: "approved",
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("expenses", updatedExpense);

      return HttpResponse.json(updatedExpense);
    },
  ),

  http.post(
    "/api/expenses/:id/reject",
    async ({ params, request }) => {
      const expenseId = String(params.id);
      const expense = await getRecord<MockExpense>(
        "expenses",
        expenseId,
      );

      if (!expense) {
        return HttpResponse.json(
          { message: "Expense not found." },
          { status: 404 },
        );
      }

      const authorization = await authorizeRequest(request, {
        permission: "expenses.reject",
        scope: "ORGANIZATION",
        resource: { organizationId: expense.organizationId },
      });

      if (!authorization.allowed) {
        return authorizationError(authorization);
      }

      if (expense.status !== "under_review") {
        return HttpResponse.json(
          {
            message:
              "Only expenses under review can be rejected.",
          },
          { status: 409 },
        );
      }

      const body = (await request.json()) as {
        reason: string;
      };
      const reason = body.reason.trim();

      if (!reason) {
        return HttpResponse.json(
          { message: "A rejection reason is required." },
          { status: 400 },
        );
      }

      const updatedExpense = {
        ...expense,
        status: "rejected",
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      };

      await saveRecord("expenses", updatedExpense);

      return HttpResponse.json(updatedExpense);
    },
  ),
];
