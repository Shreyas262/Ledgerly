import { describe, expect, it } from "vitest";

import type { DelegationCandidate, DelegationList, DelegationView } from "../../features/approvals/types/delegation";
import { saveRecord } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { auditEventsFor, givenUser, withFixedToday, type DemoRole } from "../../test/fixtures";

setupApiServer();
withFixedToday("2026-10-26");

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

function post(path: string, cookie: string, body?: unknown): Promise<Response> {
  return apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, cookie);
}

function delegate(cookie: string, delegateId: string, startDate = "2026-10-26", endDate = "2026-11-06"): Promise<Response> {
  return post("/api/delegations", cookie, { delegateId, startDate, endDate });
}

async function listOf(cookie: string): Promise<DelegationList> {
  const response = await apiFetch("/api/delegations", {}, cookie);
  expect(response.status).toBe(200);
  return (await response.json()) as DelegationList;
}

/** A second manager, of the Administration team, who may act for Sarah Manager. */
function givenSecondManager() {
  return givenUser({ id: "user-manager-2", name: "Priya Manager", role: "manager", teamId: "team-operations", departmentId: "dept-operations" });
}

/** A second Finance user, authorized for Operations only. */
function givenSecondFinance() {
  return givenUser({ id: "user-finance-2", name: "Ravi Finance", role: "finance", teamId: "team-finance", departmentId: "dept-finance", financeDepartmentIds: ["dept-operations"] });
}

// §22.12: managers and Finance users lend their review authority for a period.
describe("creating a review delegation", () => {
  it("lets a manager delegate reviews to a Finance user, audited", async () => {
    const response = await delegate(await signInAs("manager"), "user-3");

    expect(response.status).toBe(201);
    const created = (await response.json()) as DelegationView;
    expect(created).toMatchObject({
      delegatorId: "user-2",
      delegatorName: "Sarah Manager",
      delegateId: "user-3",
      delegateName: "Mike Finance",
      delegateRole: "finance",
      startDate: "2026-10-26",
      endDate: "2026-11-06",
      status: "active",
      inEffect: true,
    });
    expect(await auditEventsFor(created.id)).toEqual([
      expect.objectContaining({
        action: "DELEGATION_CREATED",
        entityType: "DELEGATION",
        actorId: "user-2",
        newState: "active",
        metadata: { delegateId: "user-3", startDate: "2026-10-26", endDate: "2026-11-06" },
        description: "Delegated expense reviews to Mike Finance from 26 Oct 2026 to 6 Nov 2026.",
      }),
    ]);
  });

  it("schedules a delegation that starts later and lists it for both people", async () => {
    const created = (await (await delegate(await signInAs("manager"), "user-3", "2026-11-02", "2026-11-13")).json()) as DelegationView;

    expect(created).toMatchObject({ status: "scheduled", inEffect: false });
    expect((await listOf(await signInAs("manager"))).given).toEqual([expect.objectContaining({ id: created.id })]);
    expect((await listOf(await signInAs("finance"))).received).toEqual([expect.objectContaining({ id: created.id, delegatorName: "Sarah Manager" })]);
  });

  it.each([
    ["themselves", "user-2", "You cannot delegate reviews to yourself."],
    ["an employee", "user-1", "Reviews can be delegated only to a manager or Finance user who reviews expenses."],
    ["an administrator", "user-4", "Reviews can be delegated only to a manager or Finance user who reviews expenses."],
    ["someone who does not exist", "user-missing", "Choose an active colleague in your organization."],
    ["nobody", "", "Choose who will review on your behalf."],
  ])("refuses a delegation to %s", async (_name, delegateId, message) => {
    const response = await delegate(await signInAs("manager"), delegateId);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR", details: { fieldErrors: { delegateId: message } } });
  });

  it("refuses inactive colleagues and users of another organization", async () => {
    const inactive = await givenSecondManager();
    await saveRecord("users", { id: inactive.id, organizationId: "org-1", departmentId: "dept-operations", teamId: "team-operations", roleId: "role-manager", name: "Priya Manager", status: "inactive" });
    await saveRecord("users", { id: "user-elsewhere", organizationId: "org-2", departmentId: "dept-x", teamId: "team-x", roleId: "role-manager", name: "Elsewhere Manager", status: "active" });
    const manager = await signInAs("manager");

    for (const delegateId of [inactive.id, "user-elsewhere"]) {
      expect(await (await delegate(manager, delegateId)).json()).toMatchObject({
        status: 422,
        details: { fieldErrors: { delegateId: "Choose an active colleague in your organization." } },
      });
    }
  });

  it("keeps Finance reviews at Finance level", async () => {
    await givenSecondFinance();
    const finance = await signInAs("finance");

    expect(await (await delegate(finance, "user-2")).json()).toMatchObject({
      details: { fieldErrors: { delegateId: "A Finance user's reviews can be delegated only to another Finance user." } },
    });
    expect((await delegate(finance, "user-finance-2")).status).toBe(201);
  });

  it.each([
    ["a start in the past", "2026-10-25", "2026-11-06", { startDate: "The start date cannot be in the past." }],
    ["an end before the start", "2026-11-06", "2026-11-05", { endDate: "The end date must be on or after the start date." }],
    ["more than 90 days", "2026-10-26", "2027-01-24", { endDate: "A delegation can last at most 90 days." }],
    ["dates that do not exist", "2026-02-30", "soon", { startDate: "Enter a valid start date.", endDate: "Enter a valid end date." }],
  ])("refuses %s", async (_name, startDate, endDate, fieldErrors) => {
    const response = await delegate(await signInAs("manager"), "user-3", startDate, endDate);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ details: { fieldErrors } });
  });

  it("accepts exactly 90 days", async () => {
    expect((await delegate(await signInAs("manager"), "user-3", "2026-10-26", "2027-01-23")).status).toBe(201);
  });

  it("allows one delegation at a time", async () => {
    await givenSecondManager();
    const manager = await signInAs("manager");
    const first = (await (await delegate(manager, "user-3", "2026-10-26", "2026-11-06")).json()) as DelegationView;

    const overlapping = await delegate(manager, "user-manager-2", "2026-11-06", "2026-11-20");
    expect(overlapping.status).toBe(409);
    expect(await overlapping.json()).toMatchObject({
      code: "DELEGATION_OVERLAP",
      message: "You already delegate your reviews to Mike Finance from 26 Oct 2026 to 6 Nov 2026. Cancel that delegation or choose dates outside it.",
    });

    expect((await delegate(manager, "user-manager-2", "2026-11-07", "2026-11-20")).status).toBe(201);
    await post(`/api/delegations/${first.id}/cancel`, manager);
    expect((await delegate(manager, "user-manager-2", "2026-10-26", "2026-11-06")).status).toBe(201);
  });

  it("leaves delegation to managers and Finance users", async () => {
    const admin = await signInAs("admin");

    const byAdmin = await delegate(admin, "user-3");
    expect(byAdmin.status).toBe(403);
    expect(await byAdmin.json()).toMatchObject({ message: "Administrators review every expense except their own, so they do not delegate reviews." });
    expect(await listOf(admin)).toEqual({
      delegateRestriction: "Administrators review every expense except their own, so they do not delegate reviews.",
      given: [],
      received: [],
    });
    expect((await apiFetch("/api/delegations/candidates", {}, admin)).status).toBe(403);

    for (const account of ["employee", "personal", "platform"] as const) {
      const cookie = await signIn(demoAccounts[account].email, demoAccounts[account].password);
      expect((await delegate(cookie, "user-3")).status).toBe(403);
      expect((await apiFetch("/api/delegations", {}, cookie)).status).toBe(403);
    }
  });

  it("offers only colleagues who may review on the delegator's behalf, by name and role", async () => {
    await givenSecondManager();
    await givenSecondFinance();

    const managerCandidates = (await (await apiFetch("/api/delegations/candidates", {}, await signInAs("manager"))).json()) as DelegationCandidate[];
    expect(managerCandidates).toEqual([
      { id: "user-3", name: "Mike Finance", role: "finance", teamName: "Finance Operations", departmentName: "Finance" },
      { id: "user-manager-2", name: "Priya Manager", role: "manager", teamName: "Administration", departmentName: "Operations" },
      { id: "user-finance-2", name: "Ravi Finance", role: "finance", teamName: "Finance Operations", departmentName: "Finance" },
    ]);

    const financeCandidates = (await (await apiFetch("/api/delegations/candidates", {}, await signInAs("finance"))).json()) as DelegationCandidate[];
    expect(financeCandidates.map((candidate) => candidate.id)).toEqual(["user-finance-2"]);
  });
});

describe("cancelling a review delegation", () => {
  it("lets the delegator end it at once, audited", async () => {
    const manager = await signInAs("manager");
    const created = (await (await delegate(manager, "user-3")).json()) as DelegationView;

    const response = await post(`/api/delegations/${created.id}/cancel`, manager);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "cancelled", inEffect: false });
    expect((await auditEventsFor(created.id)).find((event) => event.action === "DELEGATION_CANCELLED")).toMatchObject({
      previousState: "active",
      newState: "cancelled",
      description: "Cancelled the delegation of expense reviews to Mike Finance.",
    });
    expect(await (await post(`/api/delegations/${created.id}/cancel`, manager)).json()).toMatchObject({
      status: 409,
      message: "This delegation has already been cancelled.",
    });
  });

  it("refuses the delegate, conceals it from others and refuses one that has ended", async () => {
    const created = (await (await delegate(await signInAs("manager"), "user-3")).json()) as DelegationView;

    const byDelegate = await post(`/api/delegations/${created.id}/cancel`, await signInAs("finance"));
    expect(byDelegate.status).toBe(403);
    expect(await byDelegate.json()).toMatchObject({ message: "Only the person who delegated their reviews can cancel the delegation." });
    expect((await post(`/api/delegations/${created.id}/cancel`, await signInAs("admin"))).status).toBe(404);

    await saveRecord("delegations", { ...created, id: "delegation-ended", startDate: "2026-09-01", endDate: "2026-09-30" });
    expect(await (await post("/api/delegations/delegation-ended/cancel", await signInAs("manager"))).json()).toMatchObject({
      status: 409,
      message: "This delegation has already ended.",
    });
  });
});
