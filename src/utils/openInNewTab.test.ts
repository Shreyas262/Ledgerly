import { afterEach, describe, expect, it, vi } from "vitest";

import { openObjectUrlInNewTab } from "./openInNewTab";

function stubWindow(previewWindow: { location: { href: string }; opener: unknown; close: () => void } | null) {
  const open = vi.fn().mockReturnValueOnce(previewWindow).mockReturnValue(null);
  vi.stubGlobal("window", { open, setTimeout: vi.fn() });
  return open;
}

describe("openObjectUrlInNewTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the tab first and points it at the content once retrieved", async () => {
    const tab = { location: { href: "" }, opener: "app", close: vi.fn() };
    const open = stubWindow(tab);

    await openObjectUrlInNewTab(async () => "blob:receipt");

    expect(open).toHaveBeenCalledOnce();
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe("blob:receipt");
    expect(window.setTimeout).toHaveBeenCalledOnce();
  });

  it("opens the content directly when the browser blocked the first tab", async () => {
    const open = stubWindow(null);

    await openObjectUrlInNewTab(async () => "blob:receipt");

    expect(open).toHaveBeenLastCalledWith("blob:receipt", "_blank", "noopener,noreferrer");
  });

  it("closes the tab and passes the error on when the content cannot be retrieved", async () => {
    const tab = { location: { href: "" }, opener: null, close: vi.fn() };
    stubWindow(tab);

    await expect(openObjectUrlInNewTab(() => Promise.reject(new Error("Forbidden")))).rejects.toThrow("Forbidden");
    expect(tab.close).toHaveBeenCalledOnce();
    expect(tab.location.href).toBe("");
  });
});
