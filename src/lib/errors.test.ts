import { describe, expect, it } from "vitest";
import { MAINTENANCE_MESSAGE, describeError } from "./errors";

describe("describeError", () => {
  it("explains a failed fetch as maintenance", () => {
    expect(describeError(new TypeError("Failed to fetch"), "fallback")).toBe(
      MAINTENANCE_MESSAGE,
    );
  });

  it("keeps a specific API message", () => {
    expect(describeError(new Error("invalid_admin_secret"), "fallback")).toBe(
      "invalid_admin_secret",
    );
  });

  it("uses the fallback for unknown values", () => {
    expect(describeError("nope", "fallback")).toBe("fallback");
  });
});
