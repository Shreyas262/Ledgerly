import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ProtectedRoute } from "../../../routes/ProtectedRoute";
import { getRecord } from "../../../mocks/services/mockDataService";
import { demoUsers } from "../../../test/fixtures";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { UserProfilePage } from "./UserProfilePage";

setupPageTests();

/** The profile page behind the session guard, as the app routes it. */
function GuardedProfile() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route index element={<UserProfilePage />} />
      </Route>
    </Routes>
  );
}

describe("UserProfilePage", () => {
  it("saves the profile without re-checking the session and confirms the change", async () => {
    const { user } = await renderPage(<GuardedProfile />, { path: "/profile/*", route: "/profile", as: "employee" });

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    const name = screen.getByLabelText(/Name/);
    await user.clear(name);
    await user.type(name, "Renamed Employee");

    const sessionChecks: boolean[] = [];
    const observer = new MutationObserver(() => {
      sessionChecks.push(Boolean(screen.queryByText("Checking your session…")));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("Your profile has been updated.")).toBeInTheDocument();
    expect(await screen.findByText("Renamed Employee")).toBeInTheDocument();
    observer.disconnect();
    expect(sessionChecks).not.toContain(true);
    await waitFor(async () =>
      expect(await getRecord("users", demoUsers.employee.id)).toMatchObject({ name: "Renamed Employee" }),
    );
  });
});
