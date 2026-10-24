import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { listRecords } from "../../../mocks/services/mockDataService";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { PlatformOrganizationsPage } from "./PlatformOrganizationsPage";

setupPageTests();

async function fillOrganization() {
  const { user } = await renderPage(<PlatformOrganizationsPage />, { path: "/platform/organizations", as: "platform" });
  await user.click(await screen.findByRole("button", { name: "Create Organization" }));
  const dialog = await screen.findByRole("dialog", { name: "Create Organization" });
  await user.type(within(dialog).getByRole("textbox", { name: "Organization name" }), "Nimbus Analytics");
  await user.type(within(dialog).getByRole("textbox", { name: "Admin name" }), "Ananya Rao");
  await user.type(within(dialog).getByRole("textbox", { name: "Admin email" }), "ananya.rao@nimbus.test");
  await user.type(within(dialog).getByLabelText(/^Initial password/), "Nimbus@2026");
  await user.click(within(dialog).getByRole("button", { name: "Create" }));
  return user;
}

const organizationNames = async () => (await listRecords<{ name: string }>("organizations")).map((organization) => organization.name);

describe("PlatformOrganizationsPage creating an organization", () => {
  it("asks for confirmation and creates nothing when cancelled", async () => {
    const user = await fillOrganization();

    const confirmation = (await screen.findAllByRole("dialog")).find((dialog) =>
      dialog.textContent?.includes('Create "Nimbus Analytics" with Ananya Rao (ananya.rao@nimbus.test) as its Admin?'),
    )!;
    await user.click(within(confirmation).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
    expect(await organizationNames()).not.toContain("Nimbus Analytics");
  });

  it("creates the organization once confirmed", async () => {
    const user = await fillOrganization();

    const confirmation = (await screen.findAllByRole("dialog")).find((dialog) => dialog.textContent?.includes("as its Admin?"))!;
    await user.click(within(confirmation).getByRole("button", { name: "Create" }));

    await waitFor(async () => expect(await organizationNames()).toContain("Nimbus Analytics"));
  });
});
