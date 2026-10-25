import { describe, expect, it } from "vitest";

import type { MyTeam } from "../../features/userProfile/types/myTeam";
import { apiFetch, demoAccounts, setupApiServer, signIn } from "../../test/apiServer";
import { givenSecondAdmin, withFixedToday, type DemoRole } from "../../test/fixtures";

setupApiServer();
withFixedToday("2026-10-26");

function signInAs(role: DemoRole): Promise<string> {
  return signIn(demoAccounts[role].email, demoAccounts[role].password);
}

async function myTeam(role: DemoRole): Promise<MyTeam> {
  const response = await apiFetch("/api/me/team", {}, await signInAs(role));
  expect(response.status).toBe(200);
  return (await response.json()) as MyTeam;
}

// §9.6: who reviews the user's expenses follows the approval matrix.
describe("GET /api/me/team reviewers", () => {
  it("never lists administrators as reviewers of their own expenses", async () => {
    const onlyAdmin = await myTeam("admin");
    expect(onlyAdmin.reviewers.map((reviewer) => reviewer.name)).toEqual(["Mike Finance"]);
    expect(onlyAdmin.reviewerBasis).toBe("You are the only administrator, so Finance users authorized for your department review your expenses.");

    await givenSecondAdmin();
    const withSecond = await myTeam("admin");
    expect(withSecond.reviewers.map((reviewer) => reviewer.name)).toEqual(["Second Admin"]);
    expect(withSecond.reviewerBasis).toBe("Another administrator reviews your expenses.");
  });

  it("names whoever is reviewing on a reviewer's behalf, and until when", async () => {
    expect((await myTeam("employee")).delegates).toEqual([]);
    await apiFetch(
      "/api/delegations",
      { method: "POST", body: JSON.stringify({ delegateId: "user-3", startDate: "2026-10-26", endDate: "2026-11-06" }) },
      await signInAs("manager"),
    );

    expect((await myTeam("employee")).delegates).toEqual([
      { id: "user-3", name: "Mike Finance", role: "finance", onBehalfOfName: "Sarah Manager", endDate: "2026-11-06" },
    ]);
  });
});
