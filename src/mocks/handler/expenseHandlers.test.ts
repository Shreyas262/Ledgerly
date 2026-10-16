import { describe, expect, it } from "vitest";

import { apiFetch, demoAccounts, signIn, setupApiServer } from "../../test/apiServer";

setupApiServer();

describe("GET /api/expenses", () => {
  it("refuses requests without a session", async () => {
    const response = await apiFetch("/api/expenses");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("returns only the signed-in employee's own expenses", async () => {
    const cookie = await signIn(demoAccounts.employee.email, demoAccounts.employee.password);

    const response = await apiFetch("/api/expenses", {}, cookie);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ ownerId: string }> };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.every((expense) => expense.ownerId === "user-1")).toBe(true);
  });
});
