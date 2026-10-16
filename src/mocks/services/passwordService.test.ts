import { describe, expect, it } from "vitest";

import { hashPassword, isPasswordHash, verifyPassword } from "./passwordService";

const SALT = btoa("0123456789abcdef");
const DERIVED = btoa("x".repeat(32));

describe("passwordService", () => {
  it("hashes passwords and verifies only the original password", async () => {
    const hash = await hashPassword("correct horse");

    expect(isPasswordHash(hash)).toBe(true);
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong horse", hash)).resolves.toBe(false);
  });

  it("uses a new salt for every hash", async () => {
    const first = await hashPassword("correct horse");
    const second = await hashPassword("correct horse");

    expect(first).not.toBe(second);
    await expect(verifyPassword("correct horse", second)).resolves.toBe(true);
  });

  it.each(["0", "-1", "1.5", "abc", "", "10000001"])(
    "rejects a stored hash with an iteration count of %j",
    async (iterations) => {
      await expect(
        verifyPassword("correct horse", `pbkdf2-sha256$${iterations}$${SALT}$${DERIVED}`),
      ).resolves.toBe(false);
    },
  );

  it("accepts plaintext credentials from databases created before hashing", async () => {
    await expect(verifyPassword("legacy-secret", "legacy-secret")).resolves.toBe(true);
    await expect(verifyPassword("other", "legacy-secret")).resolves.toBe(false);
  });
});
