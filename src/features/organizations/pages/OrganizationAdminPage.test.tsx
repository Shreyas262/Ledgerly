import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getRecord, saveRecord } from "../../../mocks/services/mockDataService";
import { renderPage, setupPageTests } from "../../../test/renderPage";
import { OrganizationAdminPage } from "./OrganizationAdminPage";

setupPageTests();

describe("OrganizationAdminPage Finance authorization", () => {
  it("explains that a Finance user without assigned departments covers their own", async () => {
    const { financeDepartmentIds: _assigned, ...finance } = (await getRecord<Record<string, unknown>>("users", "user-3"))!;
    await saveRecord("users", finance);

    await renderPage(<OrganizationAdminPage />, { path: "/admin/organization", as: "admin" });

    expect(await screen.findByText(
      /Mike Finance covers this department by default: a Finance user without assigned departments covers their own department\./,
    )).toBeInTheDocument();
  });

  it("says nothing when every Finance user has assigned departments", async () => {
    await renderPage(<OrganizationAdminPage />, { path: "/admin/organization", as: "admin" });

    expect(await screen.findAllByText("Authorized Finance users")).not.toHaveLength(0);
    expect(screen.queryByText(/by default/)).not.toBeInTheDocument();
  });
});
