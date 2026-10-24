import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { listRecords } from "../../../mocks/services/mockDataService";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { RolesPage } from "./RolesPage";

setupPageTests();

describe("RolesPage create role", () => {
  it("offers permissions grouped by area with readable actions and saves the selection", async () => {
    const { user } = await renderPage(<RolesPage />, { path: "/roles", as: "admin" });

    await user.click(await screen.findByRole("button", { name: "Create Role" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Role" });
    expect(within(dialog).queryByText(/expenses\.read/)).not.toBeInTheDocument();

    const name = within(dialog).getByRole("textbox", { name: "Role name" });
    await user.clear(name);
    await user.type(name, "auditor");
    await user.click(within(within(dialog).getByRole("group", { name: "Audit" })).getByRole("checkbox", { name: "Read" }));
    await user.click(within(within(dialog).getByRole("group", { name: "Expenses" })).getByRole("checkbox", { name: "Read" }));
    await user.click(within(dialog).getByRole("button", { name: "Create Role" }));
    await user.click(await screen.findByRole("button", { name: "Create" }));

    await waitFor(async () => {
      const roles = await listRecords<{ name: string; permissions: string[] }>("roles");
      expect(roles.find((role) => role.name === "auditor")?.permissions.sort()).toEqual(["audit.read", "expenses.read"]);
    });
  });
  it("asks for at least one permission before creating a role", async () => {
    const { user } = await renderPage(<RolesPage />, { path: "/roles", as: "admin" });

    await user.click(await screen.findByRole("button", { name: "Create Role" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Role" });
    await user.type(within(dialog).getByRole("textbox", { name: "Role name" }), "observer");
    await user.click(within(dialog).getByRole("button", { name: "Create Role" }));

    expect(await within(dialog).findByText("Select at least one permission.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
  });

  it("says that a custom role sees its holders' own expenses only", async () => {
    const { user } = await renderPage(<RolesPage />, { path: "/roles", as: "admin" });

    await user.click(await screen.findByRole("button", { name: "Create Role" }));

    expect(within(await screen.findByRole("dialog", { name: "Create Role" })).getByText(
      "Expenses and analytics show holders of a custom role their own expenses only. Team, department and organization-wide expense data comes with the built-in Manager, Finance and Admin roles.",
    )).toBeInTheDocument();
  });
});
