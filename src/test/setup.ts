import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";

import { resetMockDatabase } from "../mocks/services/mockDataService";

// Every test starts from freshly seeded demo data (§33: deterministic, isolated).
beforeEach(async () => {
  await resetMockDatabase();
});

afterEach(async () => {
  if (typeof document !== "undefined") {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  }
});
