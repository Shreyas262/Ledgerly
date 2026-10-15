import { describe, expect, it } from "vitest";

import { hashPassword, isPasswordHash, verifyPassword } from "./passwordService";

describe("passwordService", () => {
  it("hashes passwords and verifies only the original password", async () => {
    const hash = await hashPassword("correct horse");

    expect(isPasswordHash(hash)).toBe(true);
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong horse", hash)).resolves.toBe(false);
  });
});
