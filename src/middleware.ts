import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
const MODEL_BACKEND_BASE =
  process.env.MODEL_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MODEL_API_BASE_URL ||
  BACKEND_BASE;
const MODEL_BACKEND_API_KEY = process.env.MODEL_BACKEND_API_KEY || "";

const PROXY_PREFIXES = [
  "/api/",
  "/v1/",
  "/images/",
  "/image-thumbnails/",
  "/health",
] as const;

function shouldProxy(pathname: string): boolean {
  return PROXY_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`) ||
      pathname.startsWith(prefix),
  );
}

export function isModelPath(pathname: string) {
  return pathname === "/v1" || pathname.startsWith("/v1/");
}

export function getProxyTargetBase(pathname: string) {
  return isModelPath(pathname) ? MODEL_BACKEND_BASE : BACKEND_BASE;
}

export function buildProxyHeaders(pathname: string, incoming: Headers) {
  const headers = new Headers(incoming);
  for (const header of ["host", "connection", "content-length"]) {
    headers.delete(header);
  }
  if (isModelPath(pathname) && MODEL_BACKEND_API_KEY) {
    headers.set("authorization", `Bearer ${MODEL_BACKEND_API_KEY}`);
  }
  return headers;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!shouldProxy(pathname)) {
    return NextResponse.next();
  }

  const targetBase = getProxyTargetBase(pathname);

  if (!targetBase) {
    return new NextResponse("Backend unavailable: BACKEND_URL is not configured", { status: 502 });
  }

  const backendUrl = `${targetBase}${pathname}${search}`;

  try {
    const headers = buildProxyHeaders(pathname, request.headers);

    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body;

    const response = await fetch(backendUrl, {
      method: request.method,
      headers,
      body,
      // @ts-expect-error duplex is a valid fetch option
      duplex: body ? "half" : undefined,
    });

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
    "/v1/:path*",
    "/images/:path*",
    "/image-thumbnails/:path*",
    "/health",
  ],
};
