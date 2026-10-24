import { ThemeProvider } from "@mui/material";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createAppTheme } from "../../../theme/theme";
import type { AuditEvent } from "../types/audit";
import { AuditTable } from "./AuditTable";

const event = {
  id: "event-1",
  organizationId: "org-1",
  actorId: "user-4",
  actorName: "Admin User",
  action: "BUDGET_UPDATED",
  entityType: "BUDGET",
  entityId: "budget-1",
  description: "Updated organization budget FY 2026-27.",
  timestamp: "2026-10-22T13:21:00.000Z",
} as AuditEvent;

describe("AuditTable", () => {
  it("shows the date and time first, so narrow screens keep it in view", () => {
    render(
      <ThemeProvider theme={createAppTheme("light")}>
        <MemoryRouter>
          <AuditTable auditEvents={[event]} />
        </MemoryRouter>
      </ThemeProvider>,
    );

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers[0]).toBe("Date and time");
    const [firstCell] = screen.getAllByRole("cell");
    expect(firstCell).toHaveTextContent("22 Oct 2026");
  });
});
