import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { RouteErrorPage } from "../components/common/RouteErrorPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { PermissionRoute } from "./PermissionRoute";
import { AccountTypeRoute } from "./AccountTypeRoute";
import { StartPageRedirect } from "./StartPageRedirect";
import { administrationPermissions, approvalPermissions } from "../features/roles/constants/permissions";

/** Loads a page from its own chunk when its route is first opened. */
// `any` mirrors React.lazy's own constraint; each page keeps its prop types.
function lazyPage<K extends string, M extends Record<K, ComponentType<any>>>(
  load: () => Promise<M>,
  exportName: K,
): LazyExoticComponent<M[K]> {
  return lazy(() => load().then((module) => ({ default: module[exportName] })));
}

const DashboardPage = lazyPage(() => import("../features/dashboard/pages/DashboardPage"), "DashboardPage");
const LoginPage = lazyPage(() => import("../features/auth/pages/LoginPage"), "LoginPage");
const ExpensesPage = lazyPage(() => import("../features/expenses/pages/ExpensesPage"), "ExpensesPage");
const ExpenseDetailsPage = lazyPage(() => import("../features/expenses/pages/ExpenseDetailsPage"), "ExpenseDetailsPage");
const RolesPage = lazyPage(() => import("../features/roles/pages/RolesPage"), "RolesPage");
const NotFound = lazyPage(() => import("../pages/NotFound"), "NotFound");
const UsersPage = lazyPage(() => import("../features/users/pages/UsersPage"), "UsersPage");
const CreateExpensePage = lazyPage(() => import("../features/expenses/pages/CreateExpensePage"), "CreateExpensePage");
const EditExpensePage = lazyPage(() => import("../features/expenses/pages/EditExpensePage"), "EditExpensePage");
const ApprovalsPage = lazyPage(() => import("../features/approvals/pages/ApprovalPage"), "ApprovalsPage");
const BudgetsPage = lazyPage(() => import("../features/budgets/pages/BudgetsPage"), "BudgetsPage");
const BudgetDetailsPage = lazyPage(() => import("../features/budgets/pages/BudgetDetailsPage"), "BudgetDetailsPage");
const EditBudgetPage = lazyPage(() => import("../features/budgets/pages/EditBudgetPage"), "EditBudgetPage");
const CreateBudgetPage = lazyPage(() => import("../features/budgets/pages/CreateBudgetPage"), "CreateBudgetPage");
const AnalyticsPage = lazyPage(() => import("../features/analytics/pages/AnalyticsPage"), "AnalyticsPage");
const PolicyDetailsPage = lazyPage(() => import("../features/policies/pages/PolicyDetailsPage"), "PolicyDetailsPage");
const CreatePolicyPage = lazyPage(() => import("../features/policies/pages/CreatePolicyPage"), "CreatePolicyPage");
const EditPolicyPage = lazyPage(() => import("../features/policies/pages/EditPolicyPage"), "EditPolicyPage");
const PoliciesPage = lazyPage(() => import("../features/policies/pages/PoliciesPage"), "PoliciesPage");
const UserProfilePage = lazyPage(() => import("../features/userProfile/pages/UserProfilePage"), "UserProfilePage");
const SettingsPage = lazyPage(() => import("../features/settings/pages/SettingsPage"), "SettingsPage");
const AuditPage = lazy(() => import("../features/audit/pages/AuditPage"));
const AuditDetailsPage = lazy(() => import("../features/audit/pages/AuditDetailsPage"));
const MyTeamPage = lazyPage(() => import("../features/userProfile/pages/MyTeamPage"), "MyTeamPage");
const AccountPage = lazyPage(() => import("../features/userProfile/pages/AccountPage"), "AccountPage");
const ActivityPage = lazyPage(() => import("../features/activity/pages/ActivityPage"), "ActivityPage");
const AdminPage = lazyPage(() => import("../features/organizations/pages/AdminPage"), "AdminPage");
const OrganizationAdminPage = lazyPage(() => import("../features/organizations/pages/OrganizationAdminPage"), "OrganizationAdminPage");
const LandingPage = lazyPage(() => import("../pages/LandingPage"), "LandingPage");
const RegisterPage = lazyPage(() => import("../features/auth/pages/RegisterPage"), "RegisterPage");
const PersonalDashboardPage = lazyPage(() => import("../features/personal/pages/PersonalDashboardPage"), "PersonalDashboardPage");
const PersonalExpensesPage = lazyPage(() => import("../features/personal/pages/PersonalExpensesPage"), "PersonalExpensesPage");
const PersonalExpenseFormPage = lazyPage(() => import("../features/personal/pages/PersonalExpenseFormPage"), "PersonalExpenseFormPage");
const PersonalExpenseDetailsPage = lazyPage(() => import("../features/personal/pages/PersonalExpenseDetailsPage"), "PersonalExpenseDetailsPage");
const PersonalBudgetsPage = lazyPage(() => import("../features/personal/pages/PersonalBudgetsPage"), "PersonalBudgetsPage");
const PersonalAnalyticsPage = lazyPage(() => import("../features/personal/pages/PersonalAnalyticsPage"), "PersonalAnalyticsPage");
const PlatformOrganizationsPage = lazyPage(() => import("../features/platform/pages/PlatformOrganizationsPage"), "PlatformOrganizationsPage");

/** Organization pages; personal accounts are sent to their own home (§5.15). */
const organizationRoutes: RouteObject[] = [
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
      <PermissionRoute permission={approvalPermissions} />
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
    path: "/account/team",
    element: <MyTeamPage />,
    handle: {
      title: "My Team",
    },
  },
];

/** Personal expense management; organization accounts never reach it. */
const personalRoutes: RouteObject[] = [
  {
    path: "/personal/dashboard",
    element: <PersonalDashboardPage />,
    handle: { title: "Dashboard" },
  },
  {
    path: "/personal/expenses",
    element: <PersonalExpensesPage />,
    handle: { title: "Expenses" },
  },
  {
    path: "/personal/expenses/new",
    element: <PersonalExpenseFormPage mode="create" />,
    handle: { title: "Add Expense" },
  },
  {
    path: "/personal/expenses/:id",
    element: <PersonalExpenseDetailsPage />,
    handle: { title: "Expense Details" },
  },
  {
    path: "/personal/expenses/:id/edit",
    element: <PersonalExpenseFormPage mode="edit" />,
    handle: { title: "Edit Expense" },
  },
  {
    path: "/personal/budgets",
    element: <PersonalBudgetsPage />,
    handle: { title: "Budgets" },
  },
  {
    path: "/personal/analytics",
    element: <PersonalAnalyticsPage />,
    handle: { title: "Spending Analytics" },
  },
];

/** Platform administration; only platform operators reach it. */
const platformRoutes: RouteObject[] = [
  {
    path: "/platform/organizations",
    element: <PlatformOrganizationsPage />,
    handle: { title: "Organizations" },
  },
];

/** Account pages shared by every kind of account. */
const accountRoutes: RouteObject[] = [
  {
    path: "/profile",
    element: <UserProfilePage />,
    handle: {
      title: "My Profile",
    },
  },
  {
    path: "/account",
    element: <AccountPage />,
    handle: {
      title: "Account",
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
];

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/auth/login",
    element: <LoginPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/auth/register",
    element: <RegisterPage />,
    errorElement: <RouteErrorPage />,
  },

  {
    element: <ProtectedRoute />,
    // Fallback when the layout itself fails.
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            // Page errors render inside the layout, keeping the navigation.
            errorElement: <RouteErrorPage />,
            children: [
              {
                // Opens the signed-in user's chosen start page.
                path: "/start",
                element: <StartPageRedirect />,
              },
              {
                element: <AccountTypeRoute accountType="organization" />,
                children: organizationRoutes,
              },
              {
                element: <AccountTypeRoute accountType="personal" />,
                children: personalRoutes,
              },
              {
                element: <AccountTypeRoute accountType="platform" />,
                children: platformRoutes,
              },
              ...accountRoutes,
            ],
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
