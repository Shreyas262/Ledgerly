import { describe, expect, it } from "vitest";

import type { AnalyticsSummary } from "../../features/analytics/types/analytics";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { givenBudget, givenExpense, withFixedToday } from "../../test/fixtures";
import { saveRecord } from "../services/mockDataService";

setupApiServer();
withFixedToday("2026-10-16");

/** Creates an Internal Auditor custom role and a member of the Engineering team holding it, signed in. */
async function signInAsAuditor(): Promise<string> {
  const admin = await signIn(demoAccounts.admin.email, demoAccounts.admin.password);
  const role = (await (await apiFetch(
    "/api/roles",
    { method: "POST", body: JSON.stringify({ name: "Internal Auditor", permissions: ["expenses.read", "analytics.read", "audit.read"] }) },
    admin,
  )).json()) as { id: string };
  const created = await apiFetch(
    "/api/users",
    {
      method: "POST",
      body: JSON.stringify({
        name: "Rhea Thomas",
        email: "rhea@ledgerly.com",
        password: "Auditor@2026",
        roleId: role.id,
        role: "Internal Auditor",
        permissions: [],
        departmentId: "dept-engineering",
        teamId: "team-engineering",
      }),
    },
    admin,
  );
  expect(created.status).toBe(201);
  return signIn("rhea@ledgerly.com", "Auditor@2026");
}

async function summary(cookie: string, query = ""): Promise<Response> {
  return apiFetch(`/api/analytics/summary?from=2026-10-01&to=2026-10-16${query}`, {}, cookie);
}

// §26.1 and §9: a custom role sees its holder's own expenses only.
describe("analytics for a custom role", () => {
  it("covers the holder's own expenses and none of the team's", async () => {
    await givenBudget();
    await givenExpense({ owner: "employee", status: "reimbursed", amount: 12_550, expenseDate: "2026-10-05" });
    const blocked = await givenExpense({ owner: "employee", status: "draft", expenseDate: "2026-10-06" });
    await saveRecord("policyEvaluations", {
      id: "evaluation-1",
      expenseId: blocked.id,
      organizationId: "org-1",
      result: "VIOLATES_POLICY",
      evaluatedAt: "2026-10-06T10:00:00.000Z",
      details: { findings: [{ rule: "maximumAmount", enforcement: "BLOCK", message: "Too much" }] },
    });
    const auditor = await signInAsAuditor();

    const response = await summary(auditor);

    expect(response.status).toBe(200);
    const body = (await response.json()) as AnalyticsSummary;
    expect(body).toMatchObject({
      scope: "OWN",
      kpis: { totalSpend: 0 },
      budgetComparison: null,
      policyCompliance: { checked: 0, blockedAttempts: 0 },
    });
    expect(body.filterOptions).toEqual({ departments: [], teams: [] });
  });

  it("refuses department and team filters", async () => {
    const auditor = await signInAsAuditor();

    expect((await summary(auditor, "&teamId=team-engineering")).status).toBe(400);
    expect((await summary(auditor, "&departmentId=dept-engineering")).status).toBe(400);
  });

  it("still gives a manager the team scope", async () => {
    await givenExpense({ owner: "employee", status: "reimbursed", amount: 12_550, expenseDate: "2026-10-05" });
    const manager = await signIn(demoAccounts.manager.email, demoAccounts.manager.password);

    expect(await (await summary(manager)).json()).toMatchObject({ scope: "TEAM", kpis: { totalSpend: 12_550 } });
  });
});
