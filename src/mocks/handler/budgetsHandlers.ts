import { http, HttpResponse } from "msw";

import { budgets } from "../data/budgets";
import type {
  Budget,
  CreateBudgetRequest,
  UpdateBudgetRequest,
} from "../../types/budget";

export const budgetsHandlers = [
  http.get("/api/budgets", () => {
    return HttpResponse.json(budgets);
  }),

  http.get("/api/budgets/:id", ({ params }) => {
    const budgetId = String(params.id);

    const budget = budgets.find(
      (item) => item.id === budgetId,
    );

    if (!budget) {
      return HttpResponse.json(
        {
          message: "Budget not found.",
        },
        {
          status: 404,
        },
      );
    }

    return HttpResponse.json(budget);
  }),

  http.post(
    "/api/budgets",
    async ({ request }) => {
      const body =
        (await request.json()) as CreateBudgetRequest;

      const now = new Date().toISOString();

      const newBudget: Budget = {
        id: crypto.randomUUID(),
        organizationId: "org-001",
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

      budgets.push(newBudget);

      return HttpResponse.json(newBudget, {
        status: 201,
      });
    },
  ),

  http.put(
    "/api/budgets/:id",
    async ({ params, request }) => {
      const budgetId = String(params.id);

      const budgetIndex = budgets.findIndex(
        (item) => item.id === budgetId,
      );

      if (budgetIndex === -1) {
        return HttpResponse.json(
          {
            message: "Budget not found.",
          },
          {
            status: 404,
          },
        );
      }

      const body =
        (await request.json()) as Omit<
          UpdateBudgetRequest,
          "id"
        >;

      const existingBudget = budgets[budgetIndex];

      const updatedBudget: Budget = {
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

      budgets[budgetIndex] = updatedBudget;

      return HttpResponse.json(updatedBudget);
    },
  ),
];