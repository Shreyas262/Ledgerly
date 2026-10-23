import { beforeEach, describe, expect, it } from "vitest";

import type { Policy } from "../../features/policies/types/policy";
import { listRecords } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { givenPolicy } from "../../test/fixtures";

setupApiServer();

const rules = { maximumAmount: { amount: 5_000, enforcement: "BLOCK" } };

function createPolicy(cookie: string, overrides: Partial<Policy> = {}): Promise<Response> {
  return apiFetch(
    "/api/policies",
    {
      method: "POST",
      body: JSON.stringify({ name: "New policy", expenseType: "MEALS", departmentIds: [], rules, status: "active", ...overrides }),
    },
    cookie,
  );
}

// §21.8: at most one active policy per expense type and department.
describe("policy conflicts", () => {
  let admin: string;

  beforeEach(async () => {
    admin = await signIn(demoAccounts.admin.email, demoAccounts.admin.password);
  });

  it("refuses a second active organization-wide policy for the same type", async () => {
    await givenPolicy({ name: "Meals", expenseType: "MEALS" });

    const response = await createPolicy(admin);

    expect(response.status).toBe(409);
    expect(await listRecords<Policy>("policies")).toHaveLength(1);
  });

  it("refuses department policies whose departments overlap", async () => {
    await givenPolicy({ expenseType: "MEALS", departmentIds: ["dept-engineering", "dept-finance"] });

    const response = await createPolicy(admin, { departmentIds: ["dept-finance", "dept-operations"] });

    expect(response.status).toBe(409);
  });

  it.each<[string, Partial<Policy>, Partial<Policy>]>([
    ["a department policy beside an organization-wide one", { departmentIds: [] }, { departmentIds: ["dept-engineering"] }],
    ["department policies for different departments", { departmentIds: ["dept-engineering"] }, { departmentIds: ["dept-finance"] }],
    ["a policy for another expense type", {}, { expenseType: "TRAVEL" }],
    ["an all-types policy beside a type-specific one", {}, { expenseType: undefined }],
    ["a draft policy for the same scope", {}, { status: "draft" }],
  ])("allows %s", async (_name, existing, created) => {
    await givenPolicy({ expenseType: "MEALS", ...existing });

    expect((await createPolicy(admin, created)).status).toBe(201);
  });

  it("does not count inactive policies as conflicts", async () => {
    await givenPolicy({ expenseType: "MEALS", status: "inactive" });

    expect((await createPolicy(admin)).status).toBe(201);
  });

  it("refuses to activate a draft that conflicts with an active policy", async () => {
    await givenPolicy({ expenseType: "MEALS" });
    const draft = await givenPolicy({ expenseType: "MEALS", status: "draft" });

    const response = await apiFetch(
      `/api/policies/${draft.id}`,
      { method: "PUT", body: JSON.stringify({ name: draft.name, expenseType: "MEALS", departmentIds: [], rules, status: "active" }) },
      admin,
    );

    expect(response.status).toBe(409);
    expect((await listRecords<Policy>("policies")).find((policy) => policy.id === draft.id)?.status).toBe("draft");
  });

  it("refuses policy changes to employees", async () => {
    const employee = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);

    expect((await createPolicy(employee)).status).toBe(403);
  });
});

// §21.3: rules a specific policy does not set come from less specific ones.
describe("inherited rules", () => {
  it("applies them in the simulator and shows them in the applicable policy", async () => {
    await givenPolicy({ name: "Standard", rules: { maximumAmount: { amount: 50_000, enforcement: "BLOCK" } } });
    await givenPolicy({ name: "Meals policy", expenseType: "MEALS", rules: { approvalThreshold: 2_000 } });
    const admin = await signIn(demoAccounts.admin.email, demoAccounts.admin.password);

    const preview = await apiFetch(
      "/api/policies/preview",
      {
        method: "POST",
        body: JSON.stringify({ expenseType: "MEALS", amount: 460_000, expenseDate: "2026-10-10", departmentId: "dept-engineering" }),
      },
      admin,
    );
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({
      evaluation: { policyName: "Meals policy", result: "VIOLATES_POLICY", details: { inheritedRules: { maximumAmount: "Standard" } } },
    });

    const employee = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);
    const applicable = await apiFetch("/api/policies/applicable?type=MEALS", {}, employee);
    expect(await applicable.json()).toMatchObject({
      policy: {
        name: "Meals policy",
        rules: { approvalThreshold: 2_000, maximumAmount: { amount: 50_000, enforcement: "BLOCK" } },
        inheritedRules: { maximumAmount: { policyName: "Standard" } },
      },
    });
  });
});
