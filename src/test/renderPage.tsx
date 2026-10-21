import { configureStore } from "@reduxjs/toolkit";
import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { Provider } from "react-redux";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { afterEach, beforeEach, vi } from "vitest";

import { ConfirmProvider } from "../components/common/ConfirmProvider";
import { AuthProvider } from "../features/auth/context/AuthContext";
import { baseApi } from "../services/api/baseApi";
import { createAppTheme } from "../theme/theme";
import { demoAccounts, setupApiServer, signIn } from "./apiServer";

const NativeRequest = globalThis.Request;

/**
 * jsdom has no base URL for Node's Request, so RTK Query's relative "/api"
 * requests are resolved against the page origin, as a browser would.
 */
class PageRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === "string" ? new URL(input, location.origin) : input, init);
  }
}

/** Runs the mock API for page tests and signs out after each test. */
export function setupPageTests(): void {
  setupApiServer();
  beforeEach(() => {
    vi.stubGlobal("Request", PageRequest);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "ledgerly.session=; Path=/; Max-Age=0";
  });
}

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <div data-testid="current-location">{`${pathname}${search}`}</div>;
}

/** Where the page navigated to, once it has left its own route. */
export async function navigatedTo(): Promise<string> {
  return (await screen.findByTestId("current-location")).textContent ?? "";
}

/**
 * Renders a page with the app's providers, a fresh API cache and a memory
 * router. With `as`, the demo user signs in through the API first and the
 * session cookie is set as the browser would hold it. With `state`, the route
 * is opened with that navigation state, as after a redirect from another page.
 */
export async function renderPage(
  element: ReactElement,
  {
    path = "/",
    route = path,
    state,
    as,
  }: { path?: string; route?: string; state?: unknown; as?: keyof typeof demoAccounts } = {},
) {
  if (as) {
    const cookie = await signIn(demoAccounts[as].email, demoAccounts[as].password);
    document.cookie = `${cookie}; Path=/`;
  }

  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });
  const router = createMemoryRouter(
    [
      { path, element },
      { path: "*", element: <CurrentLocation /> },
    ],
    { initialEntries: [state === undefined ? route : { pathname: route, state }] },
  );

  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <AuthProvider>
        <ThemeProvider theme={createAppTheme("light")}>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </ThemeProvider>
      </AuthProvider>
    </Provider>,
  );

  return { user, router };
}

/** Picks an option of a select field, as a user would with the pointer. */
export async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  field: RegExp,
  option: RegExp,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}
