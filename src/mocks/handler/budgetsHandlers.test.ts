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

// §28.3, §28.6: administrators create and edit organization budgets with an explicit period.
describe("creating and editing budgets", () => {
  let admin: string;

  beforeEach(async () => {
    admin = await signInAs("admin");
  });

  const body = { name: "Budget 2027", amount: 500_000, startDate: "2027-01-01", endDate: "2027-12-31" };

  it("creates a draft budget, audited", async () => {
    const response = await send("POST", "/api/budgets", admin, { ...body, description: "  Annual  " });

    expect(response.status).toBe(201);
    const created = (await response.json()) as OrganizationBudgetView;
    expect(created).toMatchObject({ ...body, description: "Annual", status: "draft", currency: "INR", createdBy: "user-4", viewScope: "ORGANIZATION" });
    expect(await auditEventsFor(created.id)).toEqual([
      expect.objectContaining({ action: "BUDGET_CREATED", newState: "draft", metadata: { amount: 500_000, currency: "INR" } }),
    ]);
  });

  it.each([
    ["a name", { ...body, name: "  " }, "Budget name is required."],
    ["an amount above zero", { ...body, amount: 0 }, "Budget amount must be greater than zero."],
    ["a period that ends after it starts", { ...body, endDate: "2026-12-31" }, "A valid budget period is required."],
  ])("requires %s when creating and editing", async (_name, invalid, message) => {
    const { budget } = await givenBudget({ status: "draft" });

    for (const response of [
      await send("POST", "/api/budgets", admin, invalid),
      await send("PUT", `/api/budgets/${budget.id}`, admin, invalid),
    ]) {
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR", message });
    }
    expect(await listRecords("budgets")).toHaveLength(1);
  });

  it("edits a budget and audits the previous and new amounts", async () => {
    const { budget } = await givenBudget({ status: "draft", amount: 100_000, departments: {}, teams: {} });

    const response = await send("PUT", `/api/budgets/${budget.id}`, admin, { ...body, amount: 120_000 });

    expect(response.status).toBe(200);
    expect(await getRecord<OrganizationBudget>("budgets", budget.id)).toMatchObject({ name: "Budget 2027", amount: 120_000, startDate: "2027-01-01" });
    expect(await auditEventsFor(budget.id)).toEqual([
      expect.objectContaining({ action: "BUDGET_UPDATED", metadata: { previousAmount: 100_000, newAmount: 120_000 } }),
    ]);
  });

  it("explains how much is allocated when the budget would fall below it", async () => {
    const { budget } = await givenBudget({ amount: 100_000, departments: { "dept-engineering": 50_000 }, teams: {} });

    const response = await send("PUT", `/api/budgets/${budget.id}`, admin, { ...body, amount: 49_999, startDate: budget.startDate, endDate: budget.endDate });

    expect(await response.json()).toMatchObject({
      code: "BUDGET_EXCEEDED",
      message: "The organization budget cannot be lower than its department allocations (₹50,000).",
    });
  });

  it("refuses changes to a closed budget and edits by Finance", async () => {
    const { budget: closed } = await givenBudget({ status: "closed" });
    const { budget: draft } = await givenBudget({ status: "draft" });

    const closedEdit = await send("PUT", `/api/budgets/${closed.id}`, admin, body);
    expect(closedEdit.status).toBe(409);
    expect(await closedEdit.json()).toMatchObject({ message: "Closed budgets cannot be changed." });

    const financeEdit = await send("PUT", `/api/budgets/${draft.id}`, await signInAs("finance"), body);
    expect(financeEdit.status).toBe(403);
    expect(await financeEdit.json()).toMatchObject({ message: "Only administrators can manage organization budgets and department allocations." });
  });

  it("answers not found for a budget that does not exist", async () => {
    const missing = "/api/budgets/missing";

    for (const response of [
      await apiFetch(missing, {}, admin),
      await send("PUT", missing, admin, body),
      await send("POST", `${missing}/activate`, admin),
      await send("POST", `${missing}/rollover`, admin, body),
      await send("POST", `${missing}/departments`, admin, { departmentId: "dept-engineering", amount: 1_000 }),
      await apiFetch(missing, { method: "DELETE" }, admin),
    ]) {
      expect(response.status).toBe(404);
    }
  });
});

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

  it("does not lower an allocation below what has already been reimbursed against it", async () => {
    const { budget, departmentAllocations, teamAllocations } = await givenBudget({
      amount: 100_000,
      departments: { "dept-engineering": 50_000 },
      teams: { "team-engineering": 40_000 },
      expenseTypes: [{ teamId: "team-engineering", expenseType: "MEALS", amount: 1_000 }],
    });
    await givenExpense({ status: "reimbursed", type: "TRAVEL", amount: 30_419, expenseDate: "2026-10-01" });
    await givenExpense({ status: "reimbursed", type: "MEALS", amount: 800, expenseDate: "2026-10-02" });
    // Not reimbursed yet, so not counted.
    await givenExpense({ status: "approved", type: "TRAVEL", amount: 9_000, expenseDate: "2026-10-03" });

    const department = await send("POST", `/api/budgets/${budget.id}/departments`, admin, { departmentId: "dept-engineering", amount: 31_000 });
    expect(department.status).toBe(422);
    const team = await send("POST", `/api/budgets/${budget.id}/teams`, admin, {
      departmentAllocationId: departmentAllocations[0].id,
      teamId: "team-engineering",
      amount: 10_000,
    });
    expect(team.status).toBe(422);
    expect(await team.json()).toMatchObject({
      code: "BUDGET_EXCEEDED",
      message: "The team allocation cannot be lower than the ₹31,219 already reimbursed against it.",
    });
    await expectBudgetExceeded(
      await send("POST", `/api/budgets/${budget.id}/expense-types`, admin, {
        teamAllocationId: teamAllocations[0].id,
        expenseType: "MEALS",
        amount: 500,
      }),
    );

    // Amounts that still cover the spend are accepted.
    expect((await send("POST", `/api/budgets/${budget.id}/teams`, admin, {
      departmentAllocationId: departmentAllocations[0].id,
      teamId: "team-engineering",
      amount: 31_219,
    })).status).toBe(200);
    expect((await send("POST", `/api/budgets/${budget.id}/expense-types`, admin, {
      teamAllocationId: teamAllocations[0].id,
      expenseType: "MEALS",
      amount: 800,
    })).status).toBe(200);
  });

  it("says how much is still available when an allocation exceeds its parent", async () => {
    const { budget } = await givenBudget({ amount: 100_000, departments: { "dept-engineering": 60_000 }, teams: {} });

    const response = await send("POST", `/api/budgets/${budget.id}/departments`, admin, { departmentId: "dept-finance", amount: 50_000 });

    expect(await response.json()).toMatchObject({
      code: "BUDGET_EXCEEDED",
      message: "Department allocations cannot exceed the organization budget. ₹40,000 is still available.",
      details: { businessRule: "Department allocations cannot exceed the organization budget. ₹40,000 is still available." },
    });
  });

  it("refuses departments, teams and expense types that do not fit the budget", async () => {
    await saveRecord("departments", { id: "dept-elsewhere", organizationId: "org-2", name: "Elsewhere", status: "active" });
    const { budget, departmentAllocations, teamAllocations } = await givenBudget({
      departments: { "dept-engineering": 50_000 },
      teams: { "team-engineering": 20_000 },
    });
    const expectRefusal = async (response: Response, message: string) => {
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR", message });
    };

    await expectRefusal(
      await send("POST", `/api/budgets/${budget.id}/departments`, admin, { departmentId: "dept-elsewhere", amount: 1_000 }),
      "Department does not belong to this organization.",
    );
    await expectRefusal(
      await send("POST", `/api/budgets/${budget.id}/departments`, admin, { departmentId: "dept-engineering", amount: 0 }),
      "Select a department and enter an amount greater than zero.",
    );
    await expectRefusal(
      await send("POST", `/api/budgets/${budget.id}/teams`, admin, { departmentAllocationId: departmentAllocations[0].id, teamId: "team-finance", amount: 1_000 }),
      "The team must belong to this department.",
    );
    await expectRefusal(
      await send("POST", `/api/budgets/${budget.id}/teams`, admin, { departmentAllocationId: "missing", teamId: "team-engineering", amount: 1_000 }),
      "The department has no allocation in this budget.",
    );
    await expectRefusal(
      await send("POST", `/api/budgets/${budget.id}/expense-types`, admin, { teamAllocationId: teamAllocations[0].id, expenseType: "GIFTS", amount: 1_000 }),
      "Select a team allocation and expense type, and enter an amount greater than zero.",
    );
    await expectRefusal(
      await send("POST", `/api/budgets/${budget.id}/expense-types`, admin, { teamAllocationId: "missing", expenseType: "MEALS", amount: 1_000 }),
      "The team has no allocation in this budget.",
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

  it("audits each transition with the previous and new status", async () => {
    const { budget } = await givenBudget({ status: "draft" });

    await send("POST", `/api/budgets/${budget.id}/activate`, admin);
    await send("POST", `/api/budgets/${budget.id}/close`, admin);
    await send("POST", `/api/budgets/${budget.id}/reopen`, admin);

    expect((await auditEventsFor(budget.id)).map(({ action, previousState, newState }) => ({ action, previousState, newState }))).toEqual([
      { action: "BUDGET_ACTIVATED", previousState: "draft", newState: "active" },
      { action: "BUDGET_CLOSED", previousState: "active", newState: "closed" },
      { action: "BUDGET_REOPENED", previousState: "closed", newState: "active" },
    ]);
  });

  it("leaves starting the next period to administrators and requires a name and period", async () => {
    const { budget } = await givenBudget();
    const path = `/api/budgets/${budget.id}/rollover`;

    const finance = await send("POST", path, await signInAs("finance"), { name: "Next", startDate: "2027-01-01", endDate: "2027-12-31" });
    expect(finance.status).toBe(403);
    expect(await finance.json()).toMatchObject({ message: "Only administrators can start a new budget period." });

    expect(await (await send("POST", path, admin, { name: "", startDate: "2027-01-01", endDate: "2027-12-31" })).json())
      .toMatchObject({ status: 422, message: "Budget name is required." });
    expect(await (await send("POST", path, admin, { name: "Next", startDate: "2027-12-31", endDate: "2027-01-01" })).json())
      .toMatchObject({ status: 422, message: "A valid budget period is required." });
    expect(await listRecords("budgets")).toHaveLength(1);
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

// §28.14: only drafts are deleted; budgets that have been active are closed.
describe("deleting a budget", () => {
  it("deletes a draft with its allocations, audited", async () => {
    const { budget, departmentAllocations, teamAllocations, expenseTypeBudgets } = await givenBudget({
      status: "draft",
      expenseTypes: [{ teamId: "team-engineering", expenseType: "MEALS", amount: 1_000 }],
    });

    const response = await apiFetch(`/api/budgets/${budget.id}`, { method: "DELETE" }, await signInAs("admin"));

    expect(response.status).toBe(204);
    expect(await getRecord("budgets", budget.id)).toBeUndefined();
    expect(await getRecord("departmentBudgetAllocations", departmentAllocations[0].id)).toBeUndefined();
    expect(await getRecord("teamBudgetAllocations", teamAllocations[0].id)).toBeUndefined();
    expect(await getRecord("expenseTypeBudgets", expenseTypeBudgets[0].id)).toBeUndefined();
    expect(await auditEventsFor(budget.id)).toEqual([expect.objectContaining({ action: "BUDGET_DELETED" })]);
  });

  it("refuses active and closed budgets", async () => {
    const admin = await signInAs("admin");
    const { budget: active } = await givenBudget();
    const { budget: closed } = await givenBudget({ status: "closed", startDate: "2025-01-01", endDate: "2025-12-31" });

    for (const budget of [active, closed]) {
      const response = await apiFetch(`/api/budgets/${budget.id}`, { method: "DELETE" }, admin);
      expect(response.status).toBe(409);
      expect(await getRecord("budgets", budget.id)).toBeDefined();
    }
  });

  it("is refused to Finance", async () => {
    const { budget } = await givenBudget({ status: "draft" });

    const response = await apiFetch(`/api/budgets/${budget.id}`, { method: "DELETE" }, await signInAs("finance"));

    expect(response.status).toBe(403);
    expect(await getRecord("budgets", budget.id)).toBeDefined();
  });
});
