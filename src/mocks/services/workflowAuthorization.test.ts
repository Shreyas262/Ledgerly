import { describe, expect, it } from "vitest";

import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import type { Expense } from "../../features/expenses/types/expense";
import type { Permission } from "../../features/roles/types/role";
import { demoUsers, type DemoRole } from "../../test/fixtures";
import {
  authorizeExpenseFinance,
  getReviewDenialReason,
  type ExpenseOwner,
} from "./workflowAuthorization";

const ALL_DEPARTMENTS = ["dept-engineering", "dept-finance", "dept-operations"];

function principalFor(
  role: DemoRole,
  overrides: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal {
  const user = demoUsers[role];
  return {
    userId: user.id,
    accountType: "organization",
    organizationId: "org-1",
    departmentId: user.departmentId,
    teamId: user.teamId,
    roleId: `role-${role}`,
    role,
    effectivePermissions: ["expenses.approve", "expenses.reject", "reimbursements.manage"] as Permission[],
    // Matches the seeded data: the demo Finance user is assigned every department.
    authorizedDepartmentIds: role === "finance" ? ALL_DEPARTMENTS : [user.departmentId],
    ...overrides,
  };
}

interface ReviewCase {
  owner: DemoRole;
  /** Another user with the owner's role and team, rather than the demo user. */
  otherUser?: boolean;
  escalated?: boolean;
  /** The owner's current team differs from the team on the expense. */
  movedTeams?: boolean;
  organizationId?: string;
  /** Another active administrator exists besides an administrator owner (default true). */
  otherAdminAvailable?: boolean;
}

function reviewSubject({ owner, otherUser, escalated, movedTeams, organizationId = "org-1" }: ReviewCase) {
  const user = demoUsers[owner];
  const ownerRecord: ExpenseOwner = {
    id: otherUser ? `other-${owner}` : user.id,
    organizationId,
    teamId: movedTeams ? "team-somewhere-else" : user.teamId,
    departmentId: user.departmentId,
    roleName: owner,
  };
  const expense = {
    organizationId,
    employeeId: ownerRecord.id,
    teamId: user.teamId,
    departmentId: user.departmentId,
    policyEvaluation: escalated
      ? {
          result: "REQUIRES_APPROVAL" as const,
          evaluatedAt: "2026-10-01T10:00:00.000Z",
          details: { escalated: true, approvalThreshold: 5_000 },
        }
      : undefined,
  };
  return { expense, owner: ownerRecord };
}

// §22.2 approval matrix, including policy escalation.
const REVIEW_MATRIX: Array<[string, AuthenticatedPrincipal, ReviewCase, boolean]> = [
  ["manager reviews a team member", principalFor("manager"), { owner: "employee" }, true],
  ["manager reviews their own expense", principalFor("manager"), { owner: "manager" }, false],
  ["manager reviews another manager", principalFor("manager"), { owner: "manager", otherUser: true }, false],
  ["manager reviews a Finance user", principalFor("manager", { teamId: "team-finance" }), { owner: "finance" }, false],
  ["manager reviews an escalated team member", principalFor("manager"), { owner: "employee", escalated: true }, false],
  ["manager reviews another team's member", principalFor("manager", { teamId: "team-operations" }), { owner: "employee" }, false],
  ["manager reviews a member who moved teams", principalFor("manager"), { owner: "employee", movedTeams: true }, false],
  ["Finance reviews a manager in its departments", principalFor("finance"), { owner: "manager" }, true],
  [
    "Finance reviews a manager outside its departments",
    principalFor("finance", { authorizedDepartmentIds: ["dept-finance"] }),
    { owner: "manager" },
    false,
  ],
  ["Finance reviews a team member below the threshold", principalFor("finance"), { owner: "employee" }, false],
  ["Finance reviews an escalated team member", principalFor("finance"), { owner: "employee", escalated: true }, true],
  ["Finance reviews an escalated manager", principalFor("finance"), { owner: "manager", escalated: true }, false],
  ["Finance reviews its own expense", principalFor("finance"), { owner: "finance" }, false],
  ["Finance reviews another Finance user", principalFor("finance"), { owner: "finance", otherUser: true }, false],
  ["Admin reviews a team member", principalFor("admin"), { owner: "employee" }, true],
  ["Admin reviews a Finance user", principalFor("admin"), { owner: "finance" }, true],
  ["Admin reviews an escalated manager", principalFor("admin"), { owner: "manager", escalated: true }, true],
  ["Admin reviews a member who moved teams", principalFor("admin"), { owner: "employee", movedTeams: true }, true],
  ["Admin reviews their own expense", principalFor("admin"), { owner: "admin" }, false],
  [
    "Admin reviews their own expense as the only administrator",
    principalFor("admin"),
    { owner: "admin", otherAdminAvailable: false },
    false,
  ],
  ["Admin reviews another administrator", principalFor("admin"), { owner: "admin", otherUser: true }, true],
  ["Finance reviews an administrator while another administrator exists", principalFor("finance"), { owner: "admin" }, false],
  [
    "Finance reviews the only administrator",
    principalFor("finance"),
    { owner: "admin", otherAdminAvailable: false },
    true,
  ],
  [
    "Finance reviews the only administrator outside its departments",
    principalFor("finance", { authorizedDepartmentIds: ["dept-finance"] }),
    { owner: "admin", otherAdminAvailable: false },
    false,
  ],
  [
    "manager reviews the only administrator",
    principalFor("manager", { teamId: "team-operations" }),
    { owner: "admin", otherAdminAvailable: false },
    false,
  ],
  ["Admin reviews another organization's expense", principalFor("admin"), { owner: "employee", organizationId: "org-2" }, false],
  ["employee reviews a colleague", principalFor("employee"), { owner: "employee", otherUser: true }, false],
];

describe("getReviewDenialReason", () => {
  it.each(REVIEW_MATRIX)("%s → allowed: %s", (_name, principal, reviewCase, allowed) => {
    const { expense, owner } = reviewSubject(reviewCase);

    const denial = getReviewDenialReason(principal, expense, owner, {
      otherAdminAvailable: reviewCase.otherAdminAvailable ?? true,
    });

    if (allowed) expect(denial).toBeNull();
    else expect(denial).toEqual(expect.any(String));
  });
});

function approvedExpense(overrides: Partial<Expense> = {}): Expense {
  const user = demoUsers.employee;
  return {
    id: "expense-1",
    organizationId: "org-1",
    departmentId: user.departmentId,
    teamId: user.teamId,
    employeeId: user.id,
    type: "MEALS",
    title: "Client lunch",
    amount: 1_000,
    currency: "INR",
    merchant: "",
    description: "Lunch with a client",
    expenseDate: "2026-10-01",
    status: "approved",
    documentIds: [],
    approvedBy: demoUsers.manager.id,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

// §22.5 reimbursement authority and separation of duties.
describe("authorizeExpenseFinance", () => {
  it("allows Finance to process an expense in its departments", async () => {
    await expect(authorizeExpenseFinance(principalFor("finance"), approvedExpense())).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("refuses Finance an expense it approved itself", async () => {
    const result = await authorizeExpenseFinance(
      principalFor("finance"),
      approvedExpense({ approvedBy: demoUsers.finance.id }),
    );
    expect(result.allowed).toBe(false);
  });

  it("refuses Finance an expense outside its departments", async () => {
    const result = await authorizeExpenseFinance(
      principalFor("finance", { authorizedDepartmentIds: ["dept-finance"] }),
      approvedExpense(),
    );
    expect(result.allowed).toBe(false);
  });

  it("leaves expenses submitted by Finance users to an administrator", async () => {
    const financeOwned = approvedExpense({
      employeeId: demoUsers.finance.id,
      departmentId: demoUsers.finance.departmentId,
      teamId: demoUsers.finance.teamId,
      approvedBy: demoUsers.admin.id,
    });

    expect((await authorizeExpenseFinance(principalFor("finance"), financeOwned)).allowed).toBe(false);
    expect((await authorizeExpenseFinance(principalFor("admin"), financeOwned)).allowed).toBe(true);
  });

  it("allows an administrator to process an expense they approved", async () => {
    const result = await authorizeExpenseFinance(
      principalFor("admin"),
      approvedExpense({ approvedBy: demoUsers.admin.id }),
    );
    expect(result.allowed).toBe(true);
  });

  it("refuses managers and employees", async () => {
    expect((await authorizeExpenseFinance(principalFor("manager"), approvedExpense())).allowed).toBe(false);
    expect((await authorizeExpenseFinance(principalFor("employee"), approvedExpense())).allowed).toBe(false);
  });

  it("refuses Finance without the reimbursement permission", async () => {
    const result = await authorizeExpenseFinance(
      principalFor("finance", { effectivePermissions: ["expenses.approve"] as Permission[] }),
      approvedExpense(),
    );
    expect(result.allowed).toBe(false);
  });

  it("refuses another organization's expense, even to an administrator", async () => {
    const result = await authorizeExpenseFinance(principalFor("admin"), approvedExpense({ organizationId: "org-2" }));
    expect(result.allowed).toBe(false);
  });
});
