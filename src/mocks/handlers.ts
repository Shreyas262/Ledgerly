import { http, HttpResponse } from "msw";

import type {
  CreateExpenseRequest,
  GetExpensesParams,
  UpdateExpenseRequest,
  LoginRequest,
} from "../types/api";
import type { Expense } from "../types/expense";

import { expenses } from "./data/expenses";

import { mockCredentials, mockUser } from "./data/auth";
import {
  clearMockSession,
  getMockSession,
  setMockSession,
} from "./session";

const API_BASE_URL = "/api";

export const handlers = [
  http.get(`${API_BASE_URL}/expenses`, ({ request }) => {
    const url = new URL(request.url);

    const status = url.searchParams.get("status") as
      | GetExpensesParams["status"]
      | null;

    const category = url.searchParams.get("category") as
      | GetExpensesParams["category"]
      | null;

    const employeeId = url.searchParams.get("employeeId");

    let filteredExpenses = [...expenses];

    if (status) {
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.status === status,
      );
    }

    if (category) {
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.category === category,
      );
    }

    if (employeeId) {
      filteredExpenses = filteredExpenses.filter(
        (expense) => expense.employeeId === employeeId,
      );
    }

    return HttpResponse.json({
      data: filteredExpenses,
      total: filteredExpenses.length,
    });
  }),

  http.get(`${API_BASE_URL}/expenses/:id`, ({ params }) => {
    const expense = expenses.find((item) => item.id === params.id);

    if (!expense) {
      return HttpResponse.json(
        {
          message: "Expense not found",
          code: "EXPENSE_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      data: expense,
    });
  }),

  http.post(`${API_BASE_URL}/expenses`, async ({ request }) => {
    const body = (await request.json()) as CreateExpenseRequest;

    const now = new Date().toISOString();

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      organizationId: "org-001",
      employeeId: "user-001",
      amount: body.amount,
      currency: body.currency,
      category: body.category,
      merchant: body.merchant,
      description: body.description,
      expenseDate: body.expenseDate,
      status: "DRAFT",
      reimbursementStatus: "NOT_APPLICABLE",
      createdAt: now,
      updatedAt: now,
    };

    expenses.push(newExpense);

    return HttpResponse.json(
      {
        data: newExpense,
      },
      { status: 201 },
    );
  }),

  http.patch(`${API_BASE_URL}/expenses/:id`, async ({ params, request }) => {
    const expense = expenses.find((item) => item.id === params.id);

    if (!expense) {
      return HttpResponse.json(
        {
          message: "Expense not found",
          code: "EXPENSE_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    if (expense.status !== "DRAFT") {
      return HttpResponse.json(
        {
          message: "Only draft expenses can be edited.",
          code: "EXPENSE_NOT_EDITABLE",
        },
        { status: 409 },
      );
    }

    const body = (await request.json()) as UpdateExpenseRequest;

    Object.assign(expense, {
      ...body,
      updatedAt: new Date().toISOString(),
    });

    return HttpResponse.json({
      data: expense,
    });
  }),

  http.post(`${API_BASE_URL}/expenses/:id/submit`, ({ params }) => {
    const expense = expenses.find((item) => item.id === params.id);

    if (!expense) {
      return HttpResponse.json(
        {
          message: "Expense not found",
          code: "EXPENSE_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    if (expense.status !== "DRAFT") {
      return HttpResponse.json(
        {
          message: "Only draft expenses can be submitted.",
          code: "EXPENSE_NOT_SUBMITTABLE",
        },
        { status: 409 },
      );
    }

    expense.status = "SUBMITTED";
    expense.submittedAt = new Date().toISOString();
    expense.updatedAt = new Date().toISOString();

    return HttpResponse.json({
      data: expense,
    });
  }),

  http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as LoginRequest;

    if (
      body.email !== mockCredentials.email ||
      body.password !== mockCredentials.password
    ) {
      return HttpResponse.json(
        {
          message: "Invalid email or password.",
          code: "INVALID_CREDENTIALS",
        },
        { status: 401 },
      );
    }

    const session = setMockSession(mockUser);

    return HttpResponse.json({
      data: {
        user: mockUser,
        sessionId: session.sessionId,
        isAuthenticated: true,
      },
    });
  }),

  http.post(`${API_BASE_URL}/auth/logout`, () => {
    clearMockSession();

    return HttpResponse.json({
      data: null,
    });
  }),

  http.get(`${API_BASE_URL}/auth/me`, () => {
    const session = getMockSession();

    if (!session) {
      return HttpResponse.json(
        {
          message: "No active session.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 },
      );
    }

    if (session.userId !== mockUser.id) {
      clearMockSession();

      return HttpResponse.json(
        {
          message: "Invalid session.",
          code: "INVALID_SESSION",
        },
        { status: 401 },
      );
    }

    return HttpResponse.json({
      data: mockUser,
    });
  }),
];

