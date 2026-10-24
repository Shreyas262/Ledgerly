import { screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LoginPage } from "../../../features/auth/pages/LoginPage";
import { ProtectedRoute } from "../../../routes/ProtectedRoute";
import { baseApi } from "../../../services/api/baseApi";
import { demoAccounts } from "../../../test/apiServer";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { Topbar } from "./Topbar";

setupPageTests();

function App() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="audit" element={<Topbar isMobile={false} mobileSidebarOpen={false} onMobileMenuClick={() => {}} />} />
      </Route>
      <Route path="auth/login" element={<LoginPage />} />
      <Route path="start" element={<p>Start page</p>} />
    </Routes>
  );
}

describe("signing out", () => {
  it("does not send the next user who signs in to the previous user's page", async () => {
    const { user, router, store } = await renderPage(<App />, { path: "/*", route: "/audit", as: "admin" });

    await user.click(await screen.findByRole("button", { name: "Open account menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sign Out" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Sign Out" })).getByRole("button", { name: "Sign Out" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/auth/login"));
    expect(router.state.location.state).toEqual({ signedOut: true });
    // The previous user's data is gone from the cache.
    await waitFor(() =>
      expect(Object.values(store.getState()[baseApi.reducerPath].queries).some((query) => query?.status === "fulfilled")).toBe(false),
    );

    await user.type(await screen.findByRole("textbox", { name: "Email" }), demoAccounts.employee.email);
    await user.type(screen.getByLabelText(/^Password/), demoAccounts.employee.password);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Start page")).toBeInTheDocument();
  });
});
