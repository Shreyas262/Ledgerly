import { createBrowserRouter, Navigate } from "react-router-dom";

import { DashboardPage } from "../features/analytics/pages/DashboardPage";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { PermissionRoute } from "./PermissionRoute";
import { ExpensesPage } from "../features/expenses/pages/ExpensesPage";
import { RolesPage } from "../features/roles/pages/RolesPage";
import { NotFound } from "../pages/NotFound";
import { UsersPage } from "../features/users/pages/UsersPage";

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
              }
            ],
          },
          {
            path: "/approvals",
            element: <PlaceholderPage title="Approvals" />,
            handle: {
              title: "Approvals",
            },
          },
          {
            path: "/budgets",
            element: <PlaceholderPage title="Budgets" />,
            handle: {
              title: "Budgets"
            },
          },
          {
            path: "/analytics",
            element: <PlaceholderPage title="Analytics" />,
            handle: {
              title: "Analytics"
            },
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
            path: "/policies",
            element: <PlaceholderPage title="Policies" />,
            handle: {
              title: "Policies",
            },
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