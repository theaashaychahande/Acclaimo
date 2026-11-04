import { describe, expect, it } from "vitest";
import { hashEditKey, hashName, hashNameWithIdentifier, normalizeEditKey } from "./hash";

const salt = "9f2c1d7e4b8a6c3f0e5d2a9b7c4e1f8a";

describe("hashName", () => {
  it("returns a SHA-256 hex digest", async () => {
    await expect(hashName(salt, "Rahul Sharma")).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", async () => {
    await expect(hashName(salt, "Rahul Sharma")).resolves.toBe(
      await hashName(salt, "Rahul Sharma"),
    );
  });

  it("hashes normalized variants to the same value", async () => {
    const reference = await hashName(salt, "Rahul Sharma");

    await expect(hashName(salt, "  sharma   RAHUL ")).resolves.toBe(reference);
    await expect(hashName(salt, "Sharma Rahul")).resolves.toBe(reference);
    await expect(hashName(salt, "Rahul, Sharma")).resolves.toBe(reference);
    await expect(hashName(salt, "आरोही देशमुख")).resolves.toBe(
      await hashName(salt, "देशमुख आरोही"),
    );
  });

  it("changes with the organization salt", async () => {
    const otherSalt = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";

    await expect(hashName(salt, "Rahul Sharma")).resolves.not.toBe(
      await hashName(otherSalt, "Rahul Sharma"),
    );
  });

  it("does not match different names", async () => {
    await expect(hashName(salt, "Rahul Sharma")).resolves.not.toBe(
      await hashName(salt, "Rahul Verma"),
    );
  });
});

describe("hashNameWithIdentifier", () => {
  it("normalizes the identifier before hashing", async () => {
    await expect(
      hashNameWithIdentifier(salt, "Rahul Sharma", "CS 21-B001"),
    ).resolves.toBe(await hashNameWithIdentifier(salt, " sharma rahul ", "cs21b001"));
  });

  it("changes when the identifier changes", async () => {
    await expect(hashNameWithIdentifier(salt, "Rahul Sharma", "CS21B001")).resolves.not.toBe(
      await hashNameWithIdentifier(salt, "Rahul Sharma", "CS21B002"),
    );
  });

  it("differs from the plain name hash", async () => {
    await expect(hashNameWithIdentifier(salt, "Rahul Sharma", "CS21B001")).resolves.not.toBe(
      await hashName(salt, "Rahul Sharma"),
    );
  });
});

describe("hashEditKey", () => {
  it("accepts grouped, spaced, and lowercase keys", async () => {
    const reference = await hashEditKey("ABCD-EFGH-JKMN-PQRS");

    await expect(hashEditKey(" abcd efgh jkmn pqrs ")).resolves.toBe(reference);
    await expect(hashEditKey("ABCDEFGHJKMNPQRS")).resolves.toBe(reference);
  });

  it("returns a SHA-256 hex digest", async () => {
    await expect(hashEditKey("ABCD-EFGH-JKMN-PQRS")).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with the key", async () => {
    await expect(hashEditKey("ABCD-EFGH-JKMN-PQRS")).resolves.not.toBe(
      await hashEditKey("ABCD-EFGH-JKMN-PQRT"),
    );
  });

  it("normalizes keys consistently", () => {
    expect(normalizeEditKey(" abcd-efgh jkmn ")).toBe("ABCDEFGHJKMN");
  });
});
