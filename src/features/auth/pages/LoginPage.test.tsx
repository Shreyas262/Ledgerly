import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoAccounts } from "../../../test/apiServer";
import { navigatedTo, renderPage, setupPageTests } from "../../../test/renderPage";
import { LoginPage } from "./LoginPage";

setupPageTests();

async function signInFrom(pathname: string) {
  const { user } = await renderPage(<LoginPage />, {
    path: "/auth/login",
    state: { from: { pathname } },
  });
  await user.type(await screen.findByRole("textbox", { name: "Email" }), demoAccounts.employee.email);
  await user.type(screen.getByLabelText(/^Password/), demoAccounts.employee.password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage return page", () => {
  it("returns to the page that asked for sign-in", async () => {
    await signInFrom("/expenses");

    expect(await navigatedTo()).toBe("/expenses");
  });

  it("opens the start page instead of a page in another account type's area", async () => {
    await signInFrom("/personal/dashboard");

    expect(await navigatedTo()).toBe("/start");
  });
});
