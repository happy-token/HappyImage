import { describe, expect, it } from "vitest";

import { normalizePostAuthRedirectPath } from "./auth";

describe("normalizePostAuthRedirectPath", () => {
  it("rejects login pages as post-auth destinations", () => {
    expect(normalizePostAuthRedirectPath("/login")).toBe("");
    expect(normalizePostAuthRedirectPath("/login?next=%2Fimage")).toBe("");
    expect(normalizePostAuthRedirectPath("/admin-login")).toBe("");
    expect(normalizePostAuthRedirectPath("/admin-login?next=%2Fsettings")).toBe("");
  });
});
