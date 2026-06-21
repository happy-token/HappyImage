import { describe, expect, it } from "vitest";

import { buildProxyHeaders, getProxyTargetBase, isModelPath } from "./middleware";

describe("middleware proxy helpers", () => {
  it("matches only /v1 and /v1/* as model paths", () => {
    expect(isModelPath("/v1")).toBe(true);
    expect(isModelPath("/v1/models")).toBe(true);
    expect(isModelPath("/api/image-tasks")).toBe(false);
    expect(isModelPath("/images/a.png")).toBe(false);
  });

  it("routes product and model paths to separate backend bases", () => {
    expect(getProxyTargetBase("/api/image-tasks")).toBe(
      process.env.BACKEND_URL || "http://127.0.0.1:8000",
    );
    expect(getProxyTargetBase("/v1/models")).toBe(
      process.env.MODEL_BACKEND_URL ||
        process.env.NEXT_PUBLIC_MODEL_API_BASE_URL ||
        process.env.BACKEND_URL ||
        "http://127.0.0.1:8000",
    );
  });

  it("replaces authorization only for model paths when server token is configured", () => {
    const productHeaders = buildProxyHeaders(
      "/api/image-tasks",
      new Headers({ authorization: "Bearer user-token" }),
    );
    expect(productHeaders.get("authorization")).toBe("Bearer user-token");

    const modelHeaders = buildProxyHeaders(
      "/v1/models",
      new Headers({ authorization: "Bearer browser-token" }),
    );
    if (process.env.MODEL_BACKEND_API_KEY) {
      expect(modelHeaders.get("authorization")).toBe(
        `Bearer ${process.env.MODEL_BACKEND_API_KEY}`,
      );
    } else {
      expect(modelHeaders.get("authorization")).toBe("Bearer browser-token");
    }
  });
});
