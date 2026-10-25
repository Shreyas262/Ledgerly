import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Delegation } from "../types/delegation";
import { getRecord, listRecords } from "../../../mocks/services/mockDataService";
import { givenDelegation } from "../../../test/fixtures";
import { renderPage, selectOption, setupPageTests } from "../../../test/renderPage";
import { formatDate, toDateOnly } from "../../../utils/format";
import { ReviewDelegationPage } from "./ReviewDelegationPage";

setupPageTests();

const inDays = (days: number) => toDateOnly(new Date(Date.now() + days * 86_400_000));

async function renderDelegation(as: "manager" | "finance" | "admin") {
  const rendered = await renderPage(<ReviewDelegationPage />, { path: "/account/delegation", as });
  if (as === "manager") await screen.findByRole("combobox", { name: /Delegate/ });
  return rendered;
}

describe("ReviewDelegationPage", () => {
  it("delegates the manager's reviews after confirmation and lists the delegation", async () => {
    const { user } = await renderDelegation("manager");
    await screen.findByText("Delegate your reviews");

    await selectOption(user, /Delegate/, /Mike Finance/);
    expect(screen.getByLabelText(/Start date/)).toHaveValue(toDateOnly());
    fireEvent.change(screen.getByLabelText(/End date/), { target: { value: inDays(6) } });
    await user.click(screen.getByRole("button", { name: "Delegate Reviews" }));

    const dialog = await screen.findByRole("dialog", { name: "Delegate Reviews" });
    expect(dialog).toHaveTextContent(
      `Mike Finance will be able to review the expenses that wait for you from ${formatDate(toDateOnly())} to ${formatDate(inDays(6))}, on your behalf.`,
    );
    await user.click(within(dialog).getByRole("button", { name: "Delegate" }));

    expect(await screen.findByText(`Your reviews are delegated to Mike Finance from ${formatDate(toDateOnly())} to ${formatDate(inDays(6))}.`)).toBeInTheDocument();
    expect(await screen.findByText("Mike Finance · Finance")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(await listRecords<Delegation>("delegations")).toEqual([
      expect.objectContaining({ delegatorId: "user-2", delegateId: "user-3", endDate: inDays(6) }),
    ]);
  });

  it("shows why the period was refused next to the end date", async () => {
    const { user } = await renderDelegation("manager");
    await screen.findByText("Delegate your reviews");

    await selectOption(user, /Delegate/, /Mike Finance/);
    fireEvent.change(screen.getByLabelText(/End date/), { target: { value: inDays(120) } });
    await user.click(screen.getByRole("button", { name: "Delegate Reviews" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delegate" }));

    expect(await screen.findByText("A delegation can last at most 90 days.")).toBeInTheDocument();
    expect(screen.getByLabelText(/End date/)).toHaveAttribute("aria-invalid", "true");
    expect(await listRecords("delegations")).toEqual([]);
  });

  it("cancels a delegation after a destructive confirmation", async () => {
    const delegation = await givenDelegation();
    const { user } = await renderDelegation("manager");

    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel Delegation" });
    expect(dialog).toHaveTextContent("Mike Finance will no longer review on your behalf.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel Delegation" }));

    expect(await screen.findByText("The delegation to Mike Finance has been cancelled.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Cancelled")).toBeInTheDocument());
    expect(await getRecord<Delegation>("delegations", delegation.id)).toHaveProperty("cancelledAt");
  });

  it("lists delegations received and says when nobody can be chosen", async () => {
    await givenDelegation();

    await renderDelegation("finance");

    expect(await screen.findByText("On behalf of Sarah Manager")).toBeInTheDocument();
    expect(await screen.findByText(/Nobody is available to review on your behalf\./)).toBeInTheDocument();
  });

  it("explains that administrators do not delegate", async () => {
    await renderDelegation("admin");

    expect(await screen.findByText("Administrators review every expense except their own, so they do not delegate reviews.")).toBeInTheDocument();
    expect(screen.queryByText("Your delegations")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delegate Reviews" })).not.toBeInTheDocument();
  });
});
