import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getRecord } from "../../../mocks/services/mockDataService";
import { givenPolicy } from "../../../test/fixtures";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { PolicyDetailsPage } from "./PolicyDetailsPage";

setupPageTests();

function renderPolicy(id: string) {
  return renderPage(<PolicyDetailsPage />, { path: "/policies/:id", route: `/policies/${id}`, as: "admin" });
}

describe("PolicyDetailsPage deleting a draft", () => {
  it("deletes a draft after confirmation and returns to the policies", async () => {
    const draft = await givenPolicy({ status: "draft", name: "Overlap test policy" });
    const { user } = await renderPolicy(draft.id);

    await user.click(await screen.findByRole("button", { name: "Delete Policy" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Delete Policy" })).getByRole("button", { name: "Delete" }));

    expect(await navigatedTo()).toBe("/policies");
    expect(await getRecord("policies", draft.id)).toBeUndefined();
  });

  it("offers no deletion for an active policy", async () => {
    const policy = await givenPolicy({ name: "Standard" });

    await renderPolicy(policy.id);

    expect(await screen.findByRole("button", { name: "Edit Policy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Policy" })).not.toBeInTheDocument();
  });
});
