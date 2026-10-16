import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, Suspense } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteErrorPage } from "./RouteErrorPage";

function BrokenPage(): never {
  throw new Error("Cannot read properties of undefined (reading 'amount')");
}

const StalePage = lazy(() =>
  Promise.reject(new TypeError("Failed to fetch dynamically imported module: https://ledgerly.example/assets/Old.js")),
);

function renderRoute(route: RouteObject, path: string) {
  const router = createMemoryRouter(
    [
      { ...route, errorElement: <RouteErrorPage /> },
      { path: "/dashboard", element: <h1>Dashboard</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>,
  );
  return userEvent.setup();
}

describe("RouteErrorPage", () => {
  beforeEach(() => {
    // React and the router log caught errors; keep the test output readable.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a general message without the internal error text", async () => {
    const user = renderRoute({ path: "/expenses", element: <BrokenPage /> }, "/expenses");

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("This page could not be displayed.")).toBeInTheDocument();
    expect(screen.queryByText(/Cannot read properties/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload Page" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Return to Dashboard" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("offers a reload when a page from an older version can no longer be loaded", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const user = renderRoute({ path: "/budgets", element: <StalePage /> }, "/budgets");

    expect(await screen.findByText("A new version of Ledgerly is available")).toBeInTheDocument();
    expect(screen.getByText("Reload the page to continue.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reload Page" }));

    expect(reload).toHaveBeenCalledOnce();
  });

  it("shows the not-found message for a 404 route response", async () => {
    renderRoute(
      {
        path: "/policies/:id",
        loader: () => {
          throw new Response(null, { status: 404 });
        },
        element: <p>Policy</p>,
      },
      "/policies/missing",
    );

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload Page" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Dashboard" })).toBeInTheDocument();
  });
});
