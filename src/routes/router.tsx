import { StartPageRedirect } from "./StartPageRedirect";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { lazy } from "react";

import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { PermissionRoute } from "./PermissionRoute";
import { administrationPermissions } from "../features/roles/constants/permissions";

const DashboardPage = lazy(() =>
  import("../features/dashboard/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);
const LoginPage = lazy(() =>
  import("../features/auth/pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  })),
);
const ExpensesPage = lazy(() =>
  import("../features/expenses/pages/ExpensesPage").then((module) => ({
    default: module.ExpensesPage,
  })),
);
const ExpenseDetailsPage = lazy(() =>
  import("../features/expenses/pages/ExpenseDetailsPage").then((module) => ({
    default: module.ExpenseDetailsPage,
  })),
);
const RolesPage = lazy(() =>
  import("../features/roles/pages/RolesPage").then((module) => ({
    default: module.RolesPage,
  })),
);
const NotFound = lazy(() =>
  import("../pages/NotFound").then((module) => ({ default: module.NotFound })),
);
const UsersPage = lazy(() =>
  import("../features/users/pages/UsersPage").then((module) => ({
    default: module.UsersPage,
  })),
);
const CreateExpensePage = lazy(() =>
  import("../features/expenses/pages/CreateExpensePage").then((module) => ({
    default: module.CreateExpensePage,
  })),
);
const EditExpensePage = lazy(() =>
  import("../features/expenses/pages/EditExpensePage").then((module) => ({
    default: module.EditExpensePage,
  })),
);
const ApprovalsPage = lazy(() =>
  import("../features/approvals/pages/ApprovalPage").then((module) => ({
    default: module.ApprovalsPage,
  })),
);
const BudgetsPage = lazy(() =>
  import("../features/budgets/pages/BudgetsPage").then((module) => ({
    default: module.BudgetsPage,
  })),
);
const BudgetDetailsPage = lazy(() =>
  import("../features/budgets/pages/BudgetDetailsPage").then((module) => ({
    default: module.BudgetDetailsPage,
  })),
);
const EditBudgetPage = lazy(() =>
  import("../features/budgets/pages/EditBudgetPage").then((module) => ({
    default: module.EditBudgetPage,
  })),
);
const CreateBudgetPage = lazy(() =>
  import("../features/budgets/pages/CreateBudgetPage").then((module) => ({
    default: module.CreateBudgetPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import("../features/analytics/pages/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const PolicyDetailsPage = lazy(() =>
  import("../features/policies/pages/PolicyDetailsPage").then((module) => ({
    default: module.PolicyDetailsPage,
  })),
);
const CreatePolicyPage = lazy(() =>
  import("../features/policies/pages/CreatePolicyPage").then((module) => ({
    default: module.CreatePolicyPage,
  })),
);
const EditPolicyPage = lazy(() =>
  import("../features/policies/pages/EditPolicyPage").then((module) => ({
    default: module.EditPolicyPage,
  })),
);
const PoliciesPage = lazy(() =>
  import("../features/policies/pages/PoliciesPage").then((module) => ({
    default: module.PoliciesPage,
  })),
);
const UserProfilePage = lazy(() =>
  import("../features/userProfile/pages/UserProfilePage").then((module) => ({
    default: module.UserProfilePage,
  })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const AuditPage = lazy(() => import("../features/audit/pages/AuditPage"));
const AuditDetailsPage = lazy(() =>
  import("../features/audit/pages/AuditDetailsPage").then((module) => ({
    default: module.default,
  })),
);
const MyTeamPage = lazy(() =>
  import("../features/userProfile/pages/MyTeamPage").then((module) => ({
    default: module.MyTeamPage,
  })),
);
const AccountPage = lazy(() =>
  import("../features/userProfile/pages/AccountPage").then((module) => ({
    default: module.AccountPage,
  })),
);
const ActivityPage = lazy(() =>
  import("../features/activity/pages/ActivityPage").then((module) => ({
    default: module.ActivityPage,
  })),
);
const AdminPage = lazy(() =>
  import("../features/organizations/pages/AdminPage").then((module) => ({
    default: module.AdminPage,
  })),
);
const OrganizationAdminPage = lazy(() =>
  import("../features/organizations/pages/OrganizationAdminPage").then(
    (module) => ({ default: module.OrganizationAdminPage }),
  ),
);
export const router = createBrowserRouter([
  {
    path: "/auth/login",
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
            element: <StartPageRedirect />,
          },
          {
            path: "/dashboard",
            element: <DashboardPage />,
            handle: {
              title: "Dashboard",
            },
          },
          {
            path: "/profile",
            element: <UserProfilePage />,
            handle: {
              title: "My Profile",
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
                element: <PermissionRoute permission="expenses.create" />,
                children: [
                  {
                    path: "/expenses/new",
                    element: <CreateExpensePage />,
                    handle: {
                      title: "Create Expense",
                    },
                  },
                ],
              },
              {
                element: <PermissionRoute permission="expenses.update" />,
                children: [
                  {
                    path: "/expenses/:id/edit",
                    element: <EditExpensePage />,
                    handle: {
                      title: "Edit Expense",
                    },
                  },
                ],
              },
            ],
          },
          {
            // Approvals hosts both managerial review and finance
            // reimbursement; each tab is gated by its own permission.
            element: (
              <PermissionRoute
                permission={["expenses.approve", "reimbursements.manage"]}
              />
            ),
            children: [
              {
                path: "/approvals",
                element: <ApprovalsPage />,
                handle: {
                  title: "Approvals",
                },
              },
              {
                path: "/reimbursements",
                element: <Navigate to="/approvals?tab=reimbursement" replace />,
              },
            ],
          },
          {
            element: <PermissionRoute permission="expenses.approve" />,
            children: [
              {
                path: "/approvals/:id",
                element: <ExpenseDetailsPage mode="review" />,
                handle: {
                  title: "Expense Review",
                },
              },
            ],
          },
          {
            element: <PermissionRoute permission="budgets.read" />,
            children: [
              {
                path: "/budgets",
                element: <BudgetsPage />,
                handle: {
                  title: "Budgets",
                },
              },
              {
                path: "/budgets/:id",
                element: <BudgetDetailsPage />,
                handle: {
                  title: "Budget Details",
                },
              },
              {
                element: <PermissionRoute permission="budgets.update" />,
                children: [
                  {
                    path: "/budgets/:id/edit",
                    element: <EditBudgetPage />,
                    handle: {
                      title: "Edit Budget",
                    },
                  },
                ],
              },
              {
                element: <PermissionRoute permission="budgets.create" />,
                children: [
                  {
                    path: "/budgets/new",
                    element: <CreateBudgetPage />,
                    handle: {
                      title: "Create Budget",
                    },
                  },
                ],
              },
            ],
          },
          {
            element: <PermissionRoute permission="analytics.read" />,
            children: [
              {
                path: "/analytics",
                element: <AnalyticsPage />,
                handle: {
                  title: "Spending Analytics",
                },
              },
            ],
          },
          {
            element: <PermissionRoute permission={administrationPermissions} />,
            children: [
              {
                path: "/admin",
                element: <AdminPage />,
                handle: { title: "Administration" },
              },
              {
                element: <PermissionRoute permission="organization.manage" />,
                children: [
                  {
                    path: "/admin/organization",
                    element: <OrganizationAdminPage />,
                    handle: { title: "Organization Structure" },
                  },
                ],
              },
            ],
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
              },
            ],
          },
          {
            element: <PermissionRoute permission="roles.read" />,
            children: [
              {
                path: "/roles",
                element: <RolesPage />,
                handle: {
                  title: "Roles & Permissions",
                },
              },
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
                element: <PermissionRoute permission="policies.create" />,
                children: [
                  {
                    path: "/policies/new",
                    element: <CreatePolicyPage />,
                    handle: {
                      title: "Create Policy",
                    },
                  },
                ],
              },
              {
                element: <PermissionRoute permission="policies.update" />,
                children: [
                  {
                    path: "/policies/:id/edit",
                    element: <EditPolicyPage />,
                    handle: {
                      title: "Edit Policy",
                    },
                  },
                ],
              },
            ],
          },
          {
            element: <PermissionRoute permission="audit.read" />,
            children: [
              {
                path: "/audit",
                element: <AuditPage />,
                handle: {
                  title: "Audit Log",
                },
              },
              {
                path: "/audit/:id",
                element: <AuditDetailsPage />,
                handle: {
                  title: "Audit Details",
                },
              },
            ],
          },
          {
            path: "/account",
            element: <AccountPage />,
            handle: {
              title: "Account",
            },
          },
          {
            path: "/account/team",
            element: <MyTeamPage />,
            handle: {
              title: "My Team",
            },
          },
          {
            path: "/security",
            element: <Navigate to="/activity" replace />,
          },
          {
            path: "/settings",
            element: <SettingsPage />,
            handle: {
              title: "Settings",
            },
          },
          {
            path: "/activity",
            element: <ActivityPage />,
            handle: {
              title: "Activity",
            },
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
    handle: {
      title: "",
    },
  },
]);
