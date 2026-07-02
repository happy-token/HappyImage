import { describe, expect, it } from "vitest";

import { normalizeModelProviders, normalizePostAuthRedirectPath } from "./auth";

describe("normalizePostAuthRedirectPath", () => {
  it("rejects login pages as post-auth destinations", () => {
    expect(normalizePostAuthRedirectPath("/login")).toBe("");
    expect(normalizePostAuthRedirectPath("/login?next=%2Fimage")).toBe("");
    expect(normalizePostAuthRedirectPath("/admin-login")).toBe("");
    expect(normalizePostAuthRedirectPath("/admin-login?next=%2Fsettings")).toBe("");
  });
});

describe("normalizeModelProviders", () => {
  it("preserves HappyToken image group models for the image composer", () => {
    expect(
      normalizeModelProviders([
        {
          id: "newapi-default",
          type: "happytoken",
          protocol: "openai",
          base_url: "https://gateway.happy-token.cn/v1/",
          group: "image",
          models: ["gpt-image-2", "codex-gpt-image-2"],
          api_key_configured: true,
        },
      ])
    ).toEqual([
      {
        id: "newapi-default",
        type: "happytoken",
        protocol: "openai",
        baseUrl: "https://gateway.happy-token.cn/v1",
        group: "image",
        models: ["gpt-image-2", "codex-gpt-image-2"],
        apiKeyConfigured: true,
        selected: true,
      },
    ]);
  });
});
