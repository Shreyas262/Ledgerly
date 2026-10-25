import { afterEach, beforeEach, vi } from "vitest";

import type { Delegation } from "../features/approvals/types/delegation";
import type { AuditEvent } from "../features/audit/types/audit";
import type {
  DepartmentBudgetAllocation,
  ExpenseTypeBudget,
  OrganizationBudget,
  TeamBudgetAllocation,
} from "../features/budgets/types/budget";
import type { Expense, ExpenseType } from "../features/expenses/types/expense";
import type { Policy } from "../features/policies/types/policy";
import { getRecord, listRecords, saveRecord } from "../mocks/services/mockDataService";
import { hashPassword } from "../mocks/services/passwordService";
import { toDateOnly } from "../utils/format";

/**
 * Scenario setup helpers. They write records straight to the mock database so
 * a test can arrange exactly the state it needs; the behavior under test is
 * still exercised through the API or the service.
 */

/** The seeded demo users and where they sit in the organization. */
export const demoUsers = {
  employee: { id: "user-1", departmentId: "dept-engineering", teamId: "team-engineering" },
  manager: { id: "user-2", departmentId: "dept-engineering", teamId: "team-engineering" },
  finance: { id: "user-3", departmentId: "dept-finance", teamId: "team-finance" },
  admin: { id: "user-4", departmentId: "dept-operations", teamId: "team-operations" },
} as const;

export type DemoRole = keyof typeof demoUsers;

const DEMO_TEAMS_BY_DEPARTMENT: Record<string, string[]> = {
  "dept-engineering": ["team-engineering"],
  "dept-finance": ["team-finance"],
  "dept-operations": ["team-operations"],
};

/**
 * Fixes the current date for date-dependent rules. Only Date is faked:
 * fake-indexeddb schedules its work on real timers.
 */
export function withFixedToday(date: string): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${date}T10:00:00`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

/** Stores an expense owned by a demo user (the employee unless given). */
export async function givenExpense(
  overrides: Partial<Expense> & { owner?: DemoRole } = {},
): Promise<Expense> {
  const { owner = "employee", ...fields } = overrides;
  const user = demoUsers[owner];
  const now = new Date().toISOString();
  const expense: Expense = {
    id: crypto.randomUUID(),
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
    status: "submitted",
    documentIds: [],
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
  await saveRecord("expenses", expense);
  return expense;
}

/** Stores another active administrator in the demo organization, next to the seeded one. */
export async function givenSecondAdmin(): Promise<string> {
  const admin = await getRecord<Record<string, unknown>>("users", demoUsers.admin.id);
  const id = "user-admin-2";
  await saveRecord("users", { ...admin, id, name: "Second Admin", email: "admin2@ledgerly.com" });
  return id;
}

/**
 * Stores another active user of the demo organization with one of the system
 * roles, who signs in with the returned email and password.
 */
export async function givenUser(options: {
  id: string;
  name: string;
  role: DemoRole;
  teamId: string;
  departmentId: string;
  financeDepartmentIds?: string[];
}): Promise<{ id: string; email: string; password: string }> {
  const { id, name, role, teamId, departmentId, financeDepartmentIds } = options;
  const email = `${id}@ledgerly.com`;
  const password = `${id}-password`;
  const now = new Date().toISOString();
  await saveRecord("users", {
    id,
    organizationId: "org-1",
    departmentId,
    teamId,
    roleId: `role-${role}`,
    name,
    email,
    role,
    permissions: [],
    status: "active",
    ...(financeDepartmentIds ? { financeDepartmentIds } : {}),
    createdAt: now,
    updatedAt: now,
  });
  await saveRecord("credentials", { userId: id, email, password: await hashPassword(password) });
  return { id, email, password };
}

/**
 * Stores a review delegation between demo users (Sarah Manager to Mike
 * Finance unless given), covering today and the next 13 days by default.
 */
export async function givenDelegation(
  overrides: Partial<Delegation> & { from?: DemoRole; to?: DemoRole } = {},
): Promise<Delegation> {
  const { from = "manager", to = "finance", ...fields } = overrides;
  const now = new Date();
  const delegation: Delegation = {
    id: crypto.randomUUID(),
    organizationId: "org-1",
    delegatorId: demoUsers[from].id,
    delegateId: demoUsers[to].id,
    startDate: toDateOnly(now),
    endDate: toDateOnly(new Date(now.getTime() + 13 * 86_400_000)),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...fields,
  };
  await saveRecord("delegations", delegation);
  return delegation;
}

/** Stores an expense policy (active, organization-wide, all types unless given). */
export async function givenPolicy(overrides: Partial<Policy> = {}): Promise<Policy> {
  const now = new Date().toISOString();
  const policy: Policy = {
    id: crypto.randomUUID(),
    organizationId: "org-1",
    name: "Test policy",
    departmentIds: [],
    rules: {},
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  await saveRecord("policies", policy);
  return policy;
}

export interface BudgetScenario {
  budget: OrganizationBudget;
  departmentAllocations: DepartmentBudgetAllocation[];
  teamAllocations: TeamBudgetAllocation[];
  expenseTypeBudgets: ExpenseTypeBudget[];
}

/**
 * Stores an organization budget with allocations. By default it is active,
 * covers 2026 and gives every demo department 100,000 and every demo team
 * 50,000; pass `departments` / `teams` to choose the allocations.
 */
export async function givenBudget(
  options: {
    status?: OrganizationBudget["status"];
    amount?: number;
    startDate?: string;
    endDate?: string;
    departments?: Record<string, number>;
    teams?: Record<string, number>;
    expenseTypes?: Array<{ teamId: string; expenseType: ExpenseType; amount: number }>;
  } = {},
): Promise<BudgetScenario> {
  const now = new Date().toISOString();
  const departments = options.departments ?? {
    "dept-engineering": 100_000,
    "dept-finance": 100_000,
    "dept-operations": 100_000,
  };
  const teams = options.teams ?? Object.fromEntries(
    Object.keys(departments).flatMap((departmentId) =>
      (DEMO_TEAMS_BY_DEPARTMENT[departmentId] ?? []).map((teamId) => [teamId, 50_000]),
    ),
  );

  const budget: OrganizationBudget = {
    id: crypto.randomUUID(),
    organizationId: "org-1",
    name: "Test budget",
    amount: options.amount ?? 1_000_000,
    currency: "INR",
    startDate: options.startDate ?? "2026-01-01",
    endDate: options.endDate ?? "2026-12-31",
    status: options.status ?? "active",
    createdBy: demoUsers.admin.id,
    createdAt: now,
    updatedAt: now,
  };
  await saveRecord("budgets", budget);

  const departmentAllocations: DepartmentBudgetAllocation[] = [];
  for (const [departmentId, amount] of Object.entries(departments)) {
    const allocation: DepartmentBudgetAllocation = {
      id: crypto.randomUUID(),
      organizationId: "org-1",
      organizationBudgetId: budget.id,
      departmentId,
      amount,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
    };
    await saveRecord("departmentBudgetAllocations", allocation);
    departmentAllocations.push(allocation);
  }

  const teamAllocations: TeamBudgetAllocation[] = [];
  for (const [teamId, amount] of Object.entries(teams)) {
    const departmentId = Object.keys(DEMO_TEAMS_BY_DEPARTMENT).find((id) =>
      DEMO_TEAMS_BY_DEPARTMENT[id].includes(teamId),
    );
    const departmentAllocation = departmentAllocations.find((item) => item.departmentId === departmentId);
    if (!departmentAllocation) throw new Error(`Team ${teamId} needs a department allocation.`);
    const allocation: TeamBudgetAllocation = {
      id: crypto.randomUUID(),
      organizationId: "org-1",
      organizationBudgetId: budget.id,
      departmentAllocationId: departmentAllocation.id,
      departmentId: departmentAllocation.departmentId,
      teamId,
      amount,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
    };
    await saveRecord("teamBudgetAllocations", allocation);
    teamAllocations.push(allocation);
  }

  const expenseTypeBudgets: ExpenseTypeBudget[] = [];
  for (const { teamId, expenseType, amount } of options.expenseTypes ?? []) {
    const teamAllocation = teamAllocations.find((item) => item.teamId === teamId);
    if (!teamAllocation) throw new Error(`Expense type budget needs a team allocation for ${teamId}.`);
    const typeBudget: ExpenseTypeBudget = {
      id: crypto.randomUUID(),
      organizationId: "org-1",
      organizationBudgetId: budget.id,
      departmentAllocationId: teamAllocation.departmentAllocationId,
      departmentId: teamAllocation.departmentId,
      teamAllocationId: teamAllocation.id,
      teamId,
      expenseType,
      amount,
      currency: "INR",
      createdAt: now,
      updatedAt: now,
    };
    await saveRecord("expenseTypeBudgets", typeBudget);
    expenseTypeBudgets.push(typeBudget);
  }

  return { budget, departmentAllocations, teamAllocations, expenseTypeBudgets };
}

export function readExpense(id: string): Promise<Expense | undefined> {
  return getRecord<Expense>("expenses", id);
}

/** Audit events recorded for an entity, oldest first. */
export async function auditEventsFor(entityId: string): Promise<AuditEvent[]> {
  const events = await listRecords<AuditEvent>("auditEvents");
  return events
    .filter((event) => event.entityId === entityId)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
