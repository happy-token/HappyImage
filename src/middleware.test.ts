import { afterEach, describe, expect, it, vi } from "vitest";

async function loadMiddleware(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import("./middleware");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("middleware proxy helpers", () => {
  it("matches only /v1 and /v1/* as model paths", async () => {
    const { isModelPath } = await loadMiddleware({});

    expect(isModelPath("/v1")).toBe(true);
    expect(isModelPath("/v1/models")).toBe(true);
    expect(isModelPath("/api/image-tasks")).toBe(false);
    expect(isModelPath("/images/a.png")).toBe(false);
  });

  it("routes product and model paths to separate backend bases", async () => {
    const { getProxyTargetBase } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
      MODEL_BACKEND_URL: "http://127.0.0.1:3001",
    });

    expect(getProxyTargetBase("/api/image-tasks")).toBe("http://127.0.0.1:8000");
    expect(getProxyTargetBase("/v1/models")).toBe("http://127.0.0.1:3001");
  });

  it("replaces authorization only for model paths when server token is configured", async () => {
    const { buildProxyHeaders } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
      MODEL_BACKEND_API_KEY: "sk-test",
      MODEL_BACKEND_URL: "http://127.0.0.1:3001",
    });

    const productHeaders = buildProxyHeaders(
      "/api/image-tasks",
      new Headers({ authorization: "Bearer user-token" }),
    );
    expect(productHeaders.get("authorization")).toBe("Bearer user-token");

    const modelHeaders = buildProxyHeaders(
      "/v1/models",
      new Headers({ authorization: "Bearer browser-token" }),
    );
    expect(modelHeaders.get("authorization")).toBe("Bearer sk-test");
  });
});
