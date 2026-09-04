import { createBrowserRouter, Navigate } from "react-router-dom";

import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { PermissionRoute } from "./PermissionRoute";
import { ExpensesPage } from "../features/expenses/pages/ExpensesPage";
import { ExpenseDetailsPage } from "../features/expenses/pages/ExpenseDetailsPage";
import { RolesPage } from "../features/roles/pages/RolesPage";
import { NotFound } from "../pages/NotFound";
import { UsersPage } from "../features/users/pages/UsersPage";
import { CreateExpensePage } from "../features/expenses/pages/CreateExpensePage";
import { EditExpensePage } from "../features/expenses/pages/EditExpensePage";
import { ApprovalsPage } from "../features/approvals/pages/ApprovalPage";
import { BudgetsPage } from "../features/budgets/pages/BudgetsPage";
import { BudgetDetailsPage } from "../features/budgets/pages/BudgetDetailsPage";
import { EditBudgetPage } from "../features/budgets/pages/EditBudgetPage";
import { CreateBudgetPage } from "../features/budgets/pages/CreateBudgetPage";
import { AnalyticsPage } from "../features/analytics/pages/AnalyticsPage";
import { PolicyDetailsPage } from "../features/policies/pages/PolicyDetailsPage";
import { CreatePolicyPage } from "../features/policies/pages/CreatePolicyPage";
import { EditPolicyPage } from "../features/policies/pages/EditPolicyPage";
import { PoliciesPage } from "../features/policies/pages/policiesPage";

function PlaceholderPage({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },

  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "/dashboard",
            element: <DashboardPage />,
            handle: {
              title: "Dashboard",
            },
          },
          {
            element: <PermissionRoute permission="expenses.read" />,
            children: [
              {
                path: "/expenses",
                element: <ExpensesPage />,
                handle: {
                  title: "Expenses",
                },
              },
              {
                path: "/expenses/:id",
                element: <ExpenseDetailsPage mode="default" />,
                handle: {
                  title: "Expense Details",
                },
              },
              {
                path: "/expenses/new",
                element: <CreateExpensePage />,
                handle: {
                  title: "Create Expense",
                },
              },
              {
                path: "/expenses/:id/edit",
                element: <EditExpensePage />,
                handle: {
                  title: "Edit Expense",
                },
              },
            ],
          },
          {
            element: <PermissionRoute permission="expenses.approve" />,
            children: [
              {
                path: "/approvals",
                element: <ApprovalsPage />,
                handle: {
                  title: "Approval Queue",
                },
              },
              {
                path: "/approvals/:id",
                element: (
                  <ExpenseDetailsPage mode="review"
                  />
                ),
                handle: {
                  title: "Expense Review",
                },
              },
            ]
          },
          {
            element: <PermissionRoute permission="budgets.read" />,
            children: [
              {
                path: "/budgets",
                element: <BudgetsPage />,
                handle: {
                  title: "Budgets"
                }
              },
              {
                path: "/budgets/:id",
                element: (
                  <BudgetDetailsPage />
                ),
                handle: {
                  title: "Budget Details",
                },
              },
              {
                path: "/budgets/:id/edit",
                element: <EditBudgetPage />,
                handle: {
                  title: "Edit Budget"
                }
              },
              {
                path: "/budgets/new",
                element: <CreateBudgetPage />,
                handle: {
                  title: "Create Budget"
                }
              },
            ]
          },
          {
            element: <PermissionRoute permission="analytics.read" />,
            children: [
              {
                path: "/analytics",
                element: <AnalyticsPage />,
                handle: {
                  title: "Analytics",
                },
              },
            ]
          },
          {
            element: <PermissionRoute permission="users.read" />,
            children: [
              {
                path: "/users",
                element: <UsersPage />,
                handle: {
                  title: "Users",
                },
              }
            ],
          },
          {
            element: <PermissionRoute permission="roles.read" />,
            children: [
              {
                path: "/roles",
                element: <RolesPage />,
                handle: {
                  title: "Roles & Permissions"
                },
              }
            ],
          },
          {
            element: <PermissionRoute permission="policies.read" />,
            children: [
              {
                path: "/policies",
                element: <PoliciesPage />,
                handle: {
                  title: "Policies",
                },
              },
              {
                path: "/policies/:id",
                element: <PolicyDetailsPage />,
                handle: {
                  title: "Policy Details",
                },
              },
              {
                path: "/policies/new",
                element: <CreatePolicyPage />,
                handle: {
                  title: "Create Policy",
                },
              },
              {
                path: "/policies/:id/edit",
                element: <EditPolicyPage />,
                handle: {
                  title: "Edit Policy",
                },
              },
            ]
          },
          {
            path: "/settings",
            element: <PlaceholderPage title="Settings" />,
            handle: {
              title: "Settings"
            },
          },
        ],
      },
    ]
  },
  {
    path: "*",
    element: <NotFound />,
    handle: {
      title: "",
    },
  },
]);