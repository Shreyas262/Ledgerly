import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./app/providers/AppProviders";
import { router } from "./routes/router";
import { worker } from "./mocks/browser";
import { LoadingState } from "./components/common/LoadingState";

import "./index.css";

async function enableMocking() {
  if (import.meta.env.DEV) {
    await worker.start({
      onUnhandledRequest(request, print) {
        if (new URL(request.url).pathname.startsWith("/api/")) {
          print.warning();
        }
      },
    });
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppProviders>
        <Suspense fallback={<LoadingState />}><RouterProvider router={router} /></Suspense>
      </AppProviders>
    </StrictMode>,
  );
});