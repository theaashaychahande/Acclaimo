import { describe, expect, it } from "vitest";
import { generateEditKey, generateLinkId, generateSalt } from "./ids";

describe("generateEditKey", () => {
  it("returns eight groups of four unambiguous characters", () => {
    expect(generateEditKey()).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it("does not repeat", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateEditKey()));
    expect(keys.size).toBe(200);
  });
});

describe("generateSalt", () => {
  it("returns 32 hex characters", () => {
    expect(generateSalt()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("does not repeat", () => {
    const salts = new Set(Array.from({ length: 500 }, () => generateSalt()));
    expect(salts.size).toBe(500);
  });
});

describe("generateLinkId", () => {
  it("returns ten lowercase characters without look-alike digits", () => {
    const linkId = generateLinkId();

    expect(linkId).toMatch(/^[a-z2-7]{10}$/);
    expect(linkId).not.toMatch(/[0189]/);
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateLinkId()));
    expect(ids.size).toBe(500);
  });
});
