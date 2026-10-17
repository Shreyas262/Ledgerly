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
});
