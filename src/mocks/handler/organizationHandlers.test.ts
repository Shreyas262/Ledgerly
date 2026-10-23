import { describe, expect, it } from "vitest";

import { saveRecord } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";

setupApiServer();

function send(method: "POST" | "PUT", path: string, cookie: string, body: unknown): Promise<Response> {
  return apiFetch(path, { method, body: JSON.stringify(body) }, cookie);
}

const admin = () => signIn(demoAccounts.admin.email, demoAccounts.admin.password);

// Team names are unique across the organization.
describe("team names", () => {
  it("refuses a new team named like a team in another department", async () => {
    const response = await send("POST", "/api/teams", await admin(), { name: "engineering", departmentId: "dept-finance" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: "A team with this name already exists in the organization." });
  });

  it("refuses renaming a team to another team's name", async () => {
    const response = await send("PUT", "/api/teams/team-finance", await admin(), {
      name: "Engineering",
      departmentId: "dept-finance",
      status: "active",
    });

    expect(response.status).toBe(409);
  });

  it("still lets an existing duplicate be edited without renaming it", async () => {
    await saveRecord("teams", {
      id: "team-duplicate",
      organizationId: "org-1",
      departmentId: "dept-operations",
      name: "Engineering",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const response = await send("PUT", "/api/teams/team-duplicate", await admin(), {
      name: "Engineering",
      departmentId: "dept-operations",
      status: "inactive",
    });

    expect(response.status).toBe(200);
  });
});
