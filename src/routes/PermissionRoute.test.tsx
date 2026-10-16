import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { Permission } from "../features/roles/types/role";
import { approvalPermissions } from "../features/roles/constants/permissions";
import type { DemoRole } from "../test/fixtures";
import { renderPage, setupPageTests } from "../test/renderPage";
import { PermissionRoute } from "./PermissionRoute";

setupPageTests();

function renderGuarded(permission: Permission | readonly Permission[], as: DemoRole) {
  return renderPage(
    <Routes>
      <Route element={<PermissionRoute permission={permission} />}>
        <Route index element={<p>Protected content</p>} />
      </Route>
    </Routes>,
    { path: "/guarded/*", route: "/guarded", as },
  );
}

describe("PermissionRoute", () => {
  it("opens the page when the user holds the permission", async () => {
    await renderGuarded("expenses.read", "employee");

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("opens the page when the user holds any one of the listed permissions", async () => {
    // Finance reimburses but does not approve.
    await renderGuarded(approvalPermissions, "finance");

    expect(await screen.findByText("Protected content")).toBeInTheDocument();
  });

  it("shows access denied when the user holds none of the listed permissions", async () => {
    await renderGuarded(approvalPermissions, "employee");

    expect(await screen.findByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
