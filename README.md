# Ledgerly

Ledgerly is a React-based expense management application that supports two isolated account experiences:

- **Personal accounts** — track personal expenses, budgets, receipts, and spending analytics.
- **Organizational accounts** — manage organizational expenses, budgets, approvals, policies, users, roles, analytics, and audit activity.

The application uses account-type routing so personal users remain inside the personal expense-management area while organizational users use the organization-management area.

## Features

### Personal Expense Management

- Personal spending dashboard
- Add, edit, view, and delete personal expenses
- Expense type and payment-method tracking
- Search, filtering, date-range filtering, and pagination
- Optional receipt/document attachments
- Monthly personal budgets
- Spending analytics and type-wise breakdowns
- Account, activity, profile, and settings pages
- Personal data isolated from organizational expense data

### Organizational Expense Management

- Organization dashboard
- Expense management and expense details
- Expense approvals and reimbursements
- Organization and department budgets
- Spending analytics
- Policies and policy management
- Users, roles, and permissions
- Organization administration
- Audit log and audit details
- Account, team, activity, profile, and settings pages

## Tech Stack

- React 19
- TypeScript
- Vite
- Material UI (MUI)
- Redux Toolkit / RTK Query
- React Router
- MUI X Charts
- MSW for application/API mocking
- Oxlint

The project defines a centralized MUI theme with light/dark mode support, shared components, typography, palette, spacing, shadows, and component customization.

## Project Structure

```text
src/
├── app/                 # Application providers and setup
├── components/          # Shared UI and navigation components
├── features/
│   ├── auth/            # Authentication and account type handling
│   ├── personal/        # Personal expense management
│   ├── expenses/        # Organizational expenses
│   ├── dashboard/       # Organization dashboard
│   ├── budgets/         # Organization budgets
│   ├── analytics/       # Organization analytics
│   ├── approvals/       # Approvals and reimbursements
│   ├── policies/        # Expense policies
│   ├── users/           # User management
│   ├── roles/           # Roles and permissions
│   ├── organizations/   # Organization administration
│   ├── audit/           # Audit logging
│   ├── documents/       # Receipts and documents
│   ├── activity/        # Account activity
│   ├── settings/        # User settings
│   └── userProfile/     # Profile and account pages
├── layouts/             # Application layouts
├── routes/              # Routing and authorization guards
├── store/               # Redux store
├── theme/               # MUI theme configuration
├── pages/               # Application-level pages
└── utils/               # Shared utilities
```

## Account Architecture

Ledgerly supports two account types:

| Account      | Primary Area                    | Purpose                                         |
| ------------ | ------------------------------- | ----------------------------------------------- |
| Personal     | `/personal/*`                   | Individual expense and budget management        |
| Organization | `/dashboard`, `/expenses`, etc. | Organizational expense and financial management |

Protected routing enforces account-type isolation. Personal accounts cannot access organizational routes, and organizational accounts cannot access personal routes.

Authentication and permission checks are applied through the application's route guards and authorization layer.

## Getting Started

### Prerequisites

- Node.js
- npm

### Install

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Application Routes

### Public

- `/` — Ledgerly landing page
- `/auth/login` — Login
- `/auth/register` — Registration

### Personal

- `/personal/dashboard`
- `/personal/expenses`
- `/personal/expenses/new`
- `/personal/expenses/:id`
- `/personal/expenses/:id/edit`
- `/personal/budgets`
- `/personal/analytics`

### Organization

- `/dashboard`
- `/expenses`
- `/approvals`
- `/budgets`
- `/analytics`
- `/policies`
- `/users`
- `/roles`
- `/admin`
- `/admin/organization`
- `/audit`

Shared account routes include `/profile`, `/account`, `/settings`, and `/activity`.

## Design System

Ledgerly uses a centralized MUI theme through `createAppTheme()`. The theme supports:

- Light and dark modes
- Shared palette and typography
- Consistent spacing
- Shared shadows and component styles
- Responsive MUI layouts
- Reusable application components

User theme preferences can be persisted and applied independently per signed-in user.
