import { describe, expect, it } from "vitest";

import { resolveLoginMode } from "./login-mode";

describe("resolveLoginMode", () => {
  it("uses the existing Image session for a normal entry", () => {
    expect(resolveLoginMode("")).toBe("reuse");
  });

  it("forces an OIDC round trip without provider logout for sync entry", () => {
    expect(resolveLoginMode("?sync=1")).toBe("sync");
  });

  it("keeps explicit account switching separate from sync entry", () => {
    expect(resolveLoginMode("?force=1")).toBe("force");
    expect(resolveLoginMode("?force=1&sync=1")).toBe("force");
  });
});
