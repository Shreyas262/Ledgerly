import type { ExpensePolicy } from "../../types/policy";

export const policies: ExpensePolicy[] = [
  {
    id: "policy-001",
    organizationId: "org-001",
    name: "Standard Expense Approval",
    description:
      "Default approval policy for organizational expenses.",
    approvalLimit: 50000,
    status: "active",
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-07-01T09:00:00.000Z",
  },
];