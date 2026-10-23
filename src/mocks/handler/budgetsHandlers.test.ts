import { beforeEach, describe, expect, it } from "vitest";

import type { AuthUser } from "../../features/auth/types/auth";
import type { OrganizationBudget, OrganizationBudgetView } from "../../features/budgets/types/budget";
import { getRecord, listRecords, saveRecord } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { auditEventsFor, givenBudget, givenExpense, withFixedToday, type DemoRole } from "../../test/fixtures";

setupApiServer();

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

function send(method: "POST" | "PUT", path: string, cookie: string, body?: unknown): Promise<Response> {
  return apiFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }, cookie);
}

async function expectBudgetExceeded(response: Response): Promise<void> {
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ code: "BUDGET_EXCEEDED" });
}

// §28.2: each level is capped by its parent.
describe("allocation integrity", () => {
  let admin: string;

  beforeEach(async () => {
    admin = await signInAs("admin");
  });

  it("keeps department allocations within the organization budget", async () => {
    const { budget } = await givenBudget({ amount: 100_000, departments: { "dept-engineering": 60_000 }, teams: {} });
    const path = `/api/budgets/${budget.id}/departments`;

    await expectBudgetExceeded(await send("POST", path, admin, { departmentId: "dept-finance", amount: 40_001 }));
    expect((await send("POST", path, admin, { departmentId: "dept-finance", amount: 40_000 })).status).toBe(200);
  });

  it("keeps team allocations within the department allocation", async () => {
    const { budget, departmentAllocations } = await givenBudget({
      departments: { "dept-engineering": 50_000 },
      teams: {},
    });
    const path = `/api/budgets/${budget.id}/teams`;
    const body = { departmentAllocationId: departmentAllocations[0].id, teamId: "team-engineering" };

    await expectBudgetExceeded(await send("POST", path, admin, { ...body, amount: 50_001 }));
    expect((await send("POST", path, admin, { ...body, amount: 50_000 })).status).toBe(200);
  });

  it("keeps expense-type budgets within the team allocation", async () => {
    const { budget, teamAllocations } = await givenBudget({
      departments: { "dept-engineering": 50_000 },
      teams: { "team-engineering": 20_000 },
      expenseTypes: [{ teamId: "team-engineering", expenseType: "MEALS", amount: 15_000 }],
    });
    const path = `/api/budgets/${budget.id}/expense-types`;
    const teamAllocationId = teamAllocations[0].id;

    await expectBudgetExceeded(await send("POST", path, admin, { teamAllocationId, expenseType: "TRAVEL", amount: 5_001 }));
    expect((await send("POST", path, admin, { teamAllocationId, expenseType: "TRAVEL", amount: 5_000 })).status).toBe(200);
  });

  it("does not lower any level below what is allocated beneath it", async () => {
    const { budget, departmentAllocations } = await givenBudget({
      amount: 100_000,
      departments: { "dept-engineering": 50_000 },
      teams: { "team-engineering": 30_000 },
      expenseTypes: [{ teamId: "team-engineering", expenseType: "MEALS", amount: 20_000 }],
    });

    await expectBudgetExceeded(
      await send("PUT", `/api/budgets/${budget.id}`, admin, {
        name: budget.name,
        amount: 49_999,
        startDate: budget.startDate,
        endDate: budget.endDate,
      }),
    );
    await expectBudgetExceeded(
      await send("POST", `/api/budgets/${budget.id}/departments`, admin, { departmentId: "dept-engineering", amount: 29_999 }),
    );
    await expectBudgetExceeded(
      await send("POST", `/api/budgets/${budget.id}/teams`, admin, {
        departmentAllocationId: departmentAllocations[0].id,
        teamId: "team-engineering",
        amount: 19_999,
      }),
    );
  });

  it("audits allocation changes with previous and new amounts", async () => {
    const { budget, departmentAllocations } = await givenBudget({ departments: { "dept-engineering": 50_000 }, teams: {} });

    await send("POST", `/api/budgets/${budget.id}/departments`, admin, { departmentId: "dept-engineering", amount: 70_000 });

    expect(await auditEventsFor(departmentAllocations[0].id)).toEqual([
      expect.objectContaining({
        action: "BUDGET_ALLOCATION_UPDATED",
        actorId: "user-4",
        metadata: expect.objectContaining({ previousAmount: 50_000, newAmount: 70_000 }),
      }),
    ]);
  });
});

// §28.3–28.4: Admin owns the organization and department levels; Finance the
// team and expense-type levels within its authorized departments.
describe("budget authority", () => {
  it("refuses Finance the organization and department levels", async () => {
    const { budget } = await givenBudget({ departments: {}, teams: {} });
    const finance = await signInAs("finance");

    const create = await send("POST", "/api/budgets", finance, {
      name: "Next year",
      amount: 100_000,
      startDate: "2027-01-01",
      endDate: "2027-12-31",
    });
    const allocate = await send("POST", `/api/budgets/${budget.id}/departments`, finance, {
      departmentId: "dept-engineering",
      amount: 10_000,
    });

    expect(create.status).toBe(403);
    expect(allocate.status).toBe(403);
  });

  it("lets Finance allocate teams only in its authorized departments", async () => {
    const financeUser = await getRecord<AuthUser & { financeDepartmentIds: string[] }>("users", "user-3");
    await saveRecord("users", { ...financeUser!, financeDepartmentIds: ["dept-finance"] });
    const { budget, departmentAllocations } = await givenBudget({ teams: {} });
    const allocationFor = (departmentId: string) =>
      departmentAllocations.find((item) => item.departmentId === departmentId)!.id;
    const finance = await signInAs("finance");
    const path = `/api/budgets/${budget.id}/teams`;

    const own = await send("POST", path, finance, {
      departmentAllocationId: allocationFor("dept-finance"),
      teamId: "team-finance",
      amount: 10_000,
    });
    const other = await send("POST", path, finance, {
      departmentAllocationId: allocationFor("dept-engineering"),
      teamId: "team-engineering",
      amount: 10_000,
    });

    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
  });

  it.each<DemoRole>(["manager", "employee"])("refuses team allocations to the %s", async (role) => {
    const { budget, departmentAllocations } = await givenBudget({ teams: {} });

    const response = await send("POST", `/api/budgets/${budget.id}/teams`, await signInAs(role), {
      departmentAllocationId: departmentAllocations[0].id,
      teamId: "team-engineering",
      amount: 10_000,
    });

    expect(response.status).toBe(403);
  });
});

// §28.7: one active budget per period; closed budgets can be reopened.
describe("budget lifecycle", () => {
  let admin: string;

  beforeEach(async () => {
    admin = await signInAs("admin");
  });

  it("refuses to activate a budget that overlaps the active one", async () => {
    await givenBudget({ startDate: "2026-01-01", endDate: "2026-12-31" });
    const { budget: overlapping } = await givenBudget({ status: "draft", startDate: "2026-12-01", endDate: "2027-11-30" });
    const { budget: next } = await givenBudget({ status: "draft", startDate: "2027-01-01", endDate: "2027-12-31" });

    const refused = await send("POST", `/api/budgets/${overlapping.id}/activate`, admin);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "BUDGET_OVERLAP" });
    expect((await send("POST", `/api/budgets/${next.id}/activate`, admin)).status).toBe(200);
  });

  it("refuses to move an active budget's period onto another active budget", async () => {
    await givenBudget({ startDate: "2026-01-01", endDate: "2026-12-31" });
    const { budget } = await givenBudget({ startDate: "2027-01-01", endDate: "2027-12-31" });

    const response = await send("PUT", `/api/budgets/${budget.id}`, admin, {
      name: budget.name,
      amount: budget.amount,
      startDate: "2026-07-01",
      endDate: "2027-06-30",
    });

    expect(response.status).toBe(409);
  });

  it("refuses a period change that would exclude expenses recorded against the budget", async () => {
    const { budget } = await givenBudget({ startDate: "2026-01-01", endDate: "2026-12-31" });
    await givenExpense({ status: "reimbursed", expenseDate: "2026-09-15" });
    await givenExpense({ status: "approved", expenseDate: "2026-10-22" });
    const edit = (startDate: string, endDate: string) =>
      send("PUT", `/api/budgets/${budget.id}`, admin, { name: budget.name, amount: budget.amount, startDate, endDate });

    const laterStart = await edit("2026-10-15", "2026-12-31");
    expect(laterStart.status).toBe(422);
    expect(await laterStart.json()).toMatchObject({
      code: "BUDGET_PERIOD_IN_USE",
      message: "The period must still cover the 2 expenses recorded against this budget, dated 15 Sep 2026 to 22 Oct 2026.",
    });
    expect((await edit("2026-01-01", "2026-10-10")).status).toBe(422);
    expect(await getRecord<OrganizationBudget>("budgets", budget.id)).toMatchObject({ startDate: "2026-01-01", endDate: "2026-12-31" });

    // A change that keeps every recorded expense is allowed.
    expect((await edit("2026-09-01", "2026-11-30")).status).toBe(200);
  });

  it("ignores drafts, rejected and cancelled expenses when the period changes", async () => {
    const { budget } = await givenBudget({ startDate: "2026-01-01", endDate: "2026-12-31" });
    await givenExpense({ status: "draft", expenseDate: "2026-02-01" });
    await givenExpense({ status: "rejected", expenseDate: "2026-02-01" });
    await givenExpense({ status: "cancelled", expenseDate: "2026-02-01" });

    const response = await send("PUT", `/api/budgets/${budget.id}`, admin, {
      name: budget.name,
      amount: budget.amount,
      startDate: "2026-06-01",
      endDate: "2026-12-31",
    });

    expect(response.status).toBe(200);
  });

  it("closes and reopens a budget, unless reopening would overlap", async () => {
    const { budget } = await givenBudget({ startDate: "2026-01-01", endDate: "2026-12-31" });

    expect((await send("POST", `/api/budgets/${budget.id}/close`, admin)).status).toBe(200);
    expect((await send("POST", `/api/budgets/${budget.id}/reopen`, admin)).status).toBe(200);
    expect((await getRecord<OrganizationBudget>("budgets", budget.id))?.status).toBe("active");

    await send("POST", `/api/budgets/${budget.id}/close`, admin);
    await givenBudget({ startDate: "2026-06-01", endDate: "2027-05-31" });
    expect((await send("POST", `/api/budgets/${budget.id}/reopen`, admin)).status).toBe(409);
  });

  it("refuses transitions from the wrong state and changes to closed budgets", async () => {
    const { budget, departmentAllocations } = await givenBudget();

    expect((await send("POST", `/api/budgets/${budget.id}/activate`, admin)).status).toBe(409);
    expect((await send("POST", `/api/budgets/${budget.id}/reopen`, admin)).status).toBe(409);

    await send("POST", `/api/budgets/${budget.id}/close`, admin);
    const change = await send("POST", `/api/budgets/${budget.id}/teams`, admin, {
      departmentAllocationId: departmentAllocations[0].id,
      teamId: "team-engineering",
      amount: 1_000,
    });
    expect(change.status).toBe(409);
  });

  it("leaves activation, closing and reopening to administrators", async () => {
    const { budget } = await givenBudget({ status: "draft" });
    expect((await send("POST", `/api/budgets/${budget.id}/activate`, await signInAs("finance"))).status).toBe(403);
  });

  it("starts the next period as a draft copy of every allocation level", async () => {
    const source = await givenBudget({
      departments: { "dept-engineering": 50_000 },
      teams: { "team-engineering": 30_000 },
      expenseTypes: [{ teamId: "team-engineering", expenseType: "MEALS", amount: 10_000 }],
    });

    const response = await send("POST", `/api/budgets/${source.budget.id}/rollover`, admin, {
      name: "Budget 2027",
      startDate: "2027-01-01",
      endDate: "2027-12-31",
    });

    expect(response.status).toBe(201);
    const next = (await response.json()) as OrganizationBudgetView;
    expect(next).toMatchObject({ status: "draft", amount: source.budget.amount, startDate: "2027-01-01" });
    const [department] = next.departmentAllocations;
    expect(department).toMatchObject({ departmentId: "dept-engineering", amount: 50_000 });
    expect(department.id).not.toBe(source.departmentAllocations[0].id);
    expect(department.teamAllocations).toEqual([
      expect.objectContaining({
        teamId: "team-engineering",
        amount: 30_000,
        departmentAllocationId: department.id,
        expenseTypeBudgets: [expect.objectContaining({ expenseType: "MEALS", amount: 10_000 })],
      }),
    ]);
    expect((await getRecord<OrganizationBudget>("budgets", source.budget.id))?.status).toBe("active");
  });
});

// §28.8: utilization counts reimbursed expenses dated within the period.
describe("budget utilization", () => {
  it("counts only reimbursed expenses within the budget period", async () => {
    const { budget } = await givenBudget({ startDate: "2026-01-01", endDate: "2026-12-31" });
    await givenExpense({ status: "reimbursed", amount: 2_000, expenseDate: "2026-03-01" });
    await givenExpense({ status: "approved", amount: 5_000, expenseDate: "2026-03-01" });
    await givenExpense({ status: "reimbursement_pending", amount: 5_000, expenseDate: "2026-03-01" });
    await givenExpense({ status: "reimbursed", amount: 5_000, expenseDate: "2025-12-31" });

    const response = await apiFetch(`/api/budgets/${budget.id}`, {}, await signInAs("admin"));

    const view = (await response.json()) as OrganizationBudgetView;
    expect(view.utilization.spentAmount).toBe(2_000);
    expect(view.departmentAllocations.find((item) => item.departmentId === "dept-engineering")?.utilization.spentAmount).toBe(2_000);
  });
});

// §28.16: expenses may be created only under an active, allocated budget.
describe("expense creation requires an active, allocated budget", () => {
  withFixedToday("2026-10-16");

  const expenseBody = (expenseDate = "2026-10-10") => ({
    type: "MEALS",
    title: "Team lunch",
    description: "Lunch with the project team",
    amount: 1_200,
    currency: "INR",
    expenseDate,
  });

  async function attemptCreate(role: DemoRole = "employee", expenseDate?: string) {
    const cookie = await signInAs(role);
    const period = (await (await apiFetch("/api/budgets/active-period", {}, cookie)).json()) as { canCreateExpense: boolean };
    const response = await send("POST", "/api/expenses", cookie, expenseBody(expenseDate));
    return { canCreateExpense: period.canCreateExpense, status: response.status, body: (await response.json()) as { code?: string } };
  }

  it.each<[string, () => Promise<unknown>, string]>([
    ["no budget exists", async () => undefined, "NO_ACTIVE_BUDGET"],
    ["the budget is only a draft", () => givenBudget({ status: "draft" }), "NO_ACTIVE_BUDGET"],
    ["the active budget does not cover today", () => givenBudget({ startDate: "2027-01-01", endDate: "2027-12-31" }), "NO_ACTIVE_BUDGET"],
    ["the department has no allocation", () => givenBudget({ departments: { "dept-finance": 10_000 }, teams: {} }), "NO_DEPARTMENT_ALLOCATION"],
    ["the team has no allocation", () => givenBudget({ departments: { "dept-engineering": 10_000 }, teams: {} }), "NO_TEAM_ALLOCATION"],
  ])("refuses when %s", async (_name, arrange, code) => {
    await arrange();

    const result = await attemptCreate();

    expect(result.canCreateExpense).toBe(false);
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ code });
    expect(await listRecords("expenses")).toEqual([]);
  });

  it("refuses an expense dated outside the budget period", async () => {
    await givenBudget({ startDate: "2026-10-01", endDate: "2026-12-31" });

    const result = await attemptCreate("employee", "2026-09-30");

    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ code: "OUTSIDE_BUDGET_PERIOD" });
  });

  it("applies to administrators too", async () => {
    await givenBudget({ departments: { "dept-engineering": 10_000 }, teams: { "team-engineering": 5_000 } });

    const result = await attemptCreate("admin");

    expect(result.body).toMatchObject({ code: "NO_DEPARTMENT_ALLOCATION" });
  });

  it("creates the expense when every condition holds", async () => {
    await givenBudget();

    const result = await attemptCreate();

    expect(result.canCreateExpense).toBe(true);
    expect(result.status).toBe(201);
    expect(await listRecords("expenses")).toHaveLength(1);
  });
});
