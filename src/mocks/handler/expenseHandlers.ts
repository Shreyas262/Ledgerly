import { http, HttpResponse } from "msw";

import { expenses } from "../data/expenses";
import type { CreateExpenseRequest, Expense, UpdateExpenseRequest } from "../../types/expense";

export const expensesHandlers = [
  http.get("/api/expenses", () => {
    return HttpResponse.json(expenses);
  }),
  http.get("/api/expenses/:id", ({ params }) => {
    const expenseId = String(params.id);

    const expense = expenses.find(
      (item) => item.id === expenseId,
    );

    if (!expense) {
      return HttpResponse.json(
        {
          message: "Expense not found.",
        },
        {
          status: 404,
        },
      );
    }

    return HttpResponse.json(expense);
  }),

  http.post("/api/expenses",async ({ request }) => {
      const body =
        (await request.json()) as CreateExpenseRequest;

      const now = new Date().toISOString();

      const newExpense: Expense = {
        id: crypto.randomUUID(),
        organizationId: "org-001",
        employeeId: "user-001",

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

      expenses.push(newExpense);

      return HttpResponse.json(
        newExpense,
        {
          status: 201,
        },
      );
    },
  ),
  
  http.put("/api/expenses/:id", async ({ params, request }) => {
    const expenseId = String(params.id);

    const expenseIndex = expenses.findIndex(
      (item) => item.id === expenseId,
    );

    if (expenseIndex === -1) {
      return HttpResponse.json(
        {
          message: "Expense not found.",
        },
        {
          status: 404,
        },
      );
    }

    const body =
      (await request.json()) as Omit<
        UpdateExpenseRequest,
        "id"
      >;

    const existingExpense = expenses[expenseIndex];

    if (existingExpense.status !== "draft") {
      return HttpResponse.json(
        {
          message:
            "Only draft expenses can be edited.",
        },
        {
          status: 409,
        },
      );
    }

    const updatedExpense: Expense = {
      ...existingExpense,

      title: body.title,
      description: body.description,
      amount: body.amount,
      currency: "INR",
      category: body.category,
      expenseDate: body.expenseDate,

      updatedAt: new Date().toISOString(),
    };

    expenses[expenseIndex] = updatedExpense;

    return HttpResponse.json(updatedExpense);
  }),
  
  http.post("/api/expenses/:id/submit", ({ params }) => {
      const expenseId = String(params.id);

      const expenseIndex = expenses.findIndex(
        (item) => item.id === expenseId,
      );

      if (expenseIndex === -1) {
        return HttpResponse.json(
          {
            message: "Expense not found.",
          },
          {
            status: 404,
          },
        );
      }

      const expense = expenses[expenseIndex];

      if (expense.status !== "draft") {
        return HttpResponse.json(
          {
            message:
              "Only draft expenses can be submitted.",
          },
          {
            status: 409,
          },
        );
      }

      const updatedExpense: Expense = {
        ...expense,
        status: "submitted",
        updatedAt: new Date().toISOString(),
      };

      expenses[expenseIndex] = updatedExpense;

      return HttpResponse.json(updatedExpense);
  }),
];