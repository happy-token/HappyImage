import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");

const PROXY_PREFIXES = [
  "/api",
  "/images",
  "/image-thumbnails",
  "/health",
] as const;

type ProxyFetchInit = RequestInit & { duplex?: "half" };

function shouldDisablePageCache(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/admin-login" ||
    pathname === "/image" ||
    pathname.startsWith("/image/")
  );
}

export function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function buildProxyUrl(pathname: string, search: string) {
  if (!BACKEND_BASE) {
    return "";
  }
  return `${BACKEND_BASE.replace(/\/+$/, "")}${pathname}${search}`;
}

export function buildProxyHeaders(incoming: Headers) {
  const headers = new Headers(incoming);
  for (const header of ["host", "connection", "content-length"]) {
    headers.delete(header);
  }
  return headers;
}

export function buildProxyFetchInit(
  request: Pick<NextRequest, "method" | "body">,
  headers: Headers,
): ProxyFetchInit {
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : request.body;

  const init: ProxyFetchInit = {
    method: request.method,
    headers,
    body,
    redirect: "manual" as const,
  };
  if (body) {
    init.duplex = "half";
  }
  return init;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!shouldProxy(pathname)) {
    const response = NextResponse.next();
    if (shouldDisablePageCache(pathname)) {
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
    }
    return response;
  }

  const backendUrl = buildProxyUrl(pathname, search);

  if (!backendUrl) {
    return new NextResponse("Backend unavailable: BACKEND_URL is not configured", { status: 502 });
  }

  try {
    const headers = buildProxyHeaders(request.headers);

    const response = await fetch(backendUrl, buildProxyFetchInit(request, headers));

    // Stream the response back
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse("Backend unavailable", { status: 502 });
  }
}

export const config = {
  matcher: [
    "/api/:path*",
    "/images/:path*",
    "/image-thumbnails/:path*",
    "/health",
    "/login",
    "/admin-login",
    "/image/:path*",
  ],
};
