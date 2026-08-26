import { createBrowserRouter } from "react-router-dom";

import { DashboardPage } from "../features/analytics/pages/DashboardPage";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { LoginPage } from "../features/auth/pages/LoginPage";

function PlaceholderPage({ title }: { title: string }) {
  return <h1>{title}</h1>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },

  {
    element: <AppLayout />,
    children: [
        {
          path: "/",
          element: <DashboardPage />,
        },
        {
          path: "/expenses",
          element: <PlaceholderPage title="Expenses" />,
        },
        {
          path: "/approvals",
          element: <PlaceholderPage title="Approvals" />,
        },
        {
          path: "/budgets",
          element: <PlaceholderPage title="Budgets" />,
        },
        {
          path: "/analytics",
          element: <PlaceholderPage title="Analytics" />,
        },
        {
          path: "/users",
          element: <PlaceholderPage title="Users" />,
        },
        {
          path: "/roles",
          element: <PlaceholderPage title="Roles & Permissions" />,
        },
        {
          path: "/policies",
          element: <PlaceholderPage title="Policies" />,
        },
        {
          path: "/settings",
          element: <PlaceholderPage title="Settings" />,
        },
    ],
  },
]);