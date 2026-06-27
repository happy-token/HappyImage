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
  it("does not proxy model API paths", async () => {
    const { shouldProxy } = await loadMiddleware({});

    expect(shouldProxy("/v1")).toBe(false);
    expect(shouldProxy("/v1/models")).toBe(false);
  });

  it("proxies product paths to BACKEND_URL", async () => {
    const { buildProxyUrl, shouldProxy } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
    });

    expect(shouldProxy("/api/image-tasks")).toBe(true);
    expect(shouldProxy("/images/a.png")).toBe(true);
    expect(shouldProxy("/image-thumbnails/a.png")).toBe(true);
    expect(shouldProxy("/health")).toBe(true);
    expect(buildProxyUrl("/api/image-tasks", "?x=1")).toBe(
      "http://127.0.0.1:8000/api/image-tasks?x=1",
    );
  });

  it("matches login pages that must not be cached", async () => {
    const { config } = await loadMiddleware({});

    expect(config.matcher).toContain("/login");
    expect(config.matcher).toContain("/admin-login");
  });

  it("uses NEXT_PUBLIC_API_BASE_URL when BACKEND_URL is not configured", async () => {
    const { buildProxyUrl } = await loadMiddleware({
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8001/",
    });

    expect(buildProxyUrl("/api/image-tasks", "")).toBe(
      "http://127.0.0.1:8001/api/image-tasks",
    );
  });

  it("preserves product credentials while stripping hop-by-hop request headers", async () => {
    const { buildProxyHeaders } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
    });
    const headers = buildProxyHeaders(
      new Headers({
        authorization: "Bearer user-token",
        cookie: "session=abc",
        host: "happyimage.local",
        connection: "keep-alive",
        "content-length": "123",
      }),
    );

    expect(headers.get("authorization")).toBe("Bearer user-token");
    expect(headers.get("cookie")).toBe("session=abc");
    expect(headers.get("host")).toBeNull();
    expect(headers.get("connection")).toBeNull();
    expect(headers.get("content-length")).toBeNull();
  });

  it("does not follow backend redirects so auth cookies survive callbacks", async () => {
    const { buildProxyFetchInit } = await loadMiddleware({
      BACKEND_URL: "http://127.0.0.1:8000",
    });

    const init = buildProxyFetchInit(
      {
        method: "GET",
        body: null,
      },
      new Headers({ accept: "text/html" }),
    );

    expect(init.redirect).toBe("manual");
    expect(init.body).toBeUndefined();
  });
});
