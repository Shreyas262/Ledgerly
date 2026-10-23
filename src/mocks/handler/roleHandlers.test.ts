import { describe, expect, it } from "vitest";

import { listRecords } from "../services/mockDataService";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";

setupApiServer();

function send(method: "POST" | "PUT", path: string, cookie: string, body: unknown): Promise<Response> {
  return apiFetch(path, { method, body: JSON.stringify(body) }, cookie);
}

// §27.4: a role grants at least one permission.
describe("role permissions", () => {
  it("refuses to create a role without permissions", async () => {
    const admin = await signIn(demoAccounts.admin.email, demoAccounts.admin.password);

    const response = await send("POST", "/api/roles", admin, { name: "Observer", permissions: [] });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ details: { fieldErrors: { permissions: "Select at least one permission." } } });
    expect((await listRecords<{ name: string }>("roles")).some((role) => role.name === "Observer")).toBe(false);
  });

  it("refuses to remove every permission from a role", async () => {
    const admin = await signIn(demoAccounts.admin.email, demoAccounts.admin.password);
    const created = await send("POST", "/api/roles", admin, { name: "Observer", permissions: ["audit.read"] });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    expect((await send("PUT", `/api/roles/${id}`, admin, { name: "Observer", permissions: [] })).status).toBe(422);
    expect((await listRecords<{ id: string; permissions: string[] }>("roles")).find((role) => role.id === id)?.permissions).toEqual(["audit.read"]);
  });
});
