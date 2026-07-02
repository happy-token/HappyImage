import axios, {AxiosError, type AxiosRequestConfig} from "axios";

import webConfig from "@/constants/common-env";
import {clearStoredAuthSession, getStoredAuthKey} from "@/store/auth";

type RequestConfig = AxiosRequestConfig & {
    redirectOnUnauthorized?: boolean;
};

type ErrorPayload = {
    detail?: string | { error?: string | { message?: string } };
    error?: string | { message?: string };
    message?: string;
};

function errorMessageFromValue(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }
    if (!value || typeof value !== "object") {
        return "";
    }

    const item = value as { error?: unknown; message?: unknown };
    if (typeof item.message === "string") {
        return item.message;
    }
    return errorMessageFromValue(item.error);
}

export function humanizeRequestError(message: unknown): string {
    const text = String(message || "").trim();
    const lowered = text.toLowerCase();
    if (!text) {
        return "请求失败，请稍后重试。";
    }
    if (lowered.includes("model gateway is not configured") || lowered.includes("模型供应商 base url 和 api key")) {
        return "请先在用户设置中配置模型供应商 Base URL 和 API Key。";
    }
    if (/(insufficient_quota|quota|credit|credits|balance|billing|payment required|recharge|余额|额度|欠费)/i.test(text)) {
        return "模型供应商额度不足，请先充值或更换供应商后再试。";
    }
    if (/(401|unauthorized|invalid api key|incorrect api key|invalid token|api key is invalid|apikey)/i.test(text)) {
        return "模型供应商 API Key 无效或已过期，请在用户设置里更新 API Key。";
    }
    if (/(model not found|invalid model|does not exist|unsupported model)/i.test(text)) {
        return "当前模型不可用，请在生图页面切换可用模型后再试。";
    }
    if (/(timeout|timed out|read timed out|HTTP 52[234]|HTTP 524)/i.test(text)) {
        return "模型供应商响应超时，请稍后重试。";
    }
    if (/(HTTP 50[234]|bad gateway|service unavailable|gateway timeout|cpu overload|overloaded|rate limit|too many requests|429)/i.test(text)) {
        return "模型供应商上游暂时不可用，请切换其他模型或稍后重试。";
    }
    if (/(curl:|tls connect error|openssl|connection closed abruptly|connection reset|empty reply from server|server disconnected|connection aborted)/i.test(text)) {
        return "连接模型供应商失败，请稍后重试；如果持续出现，请检查 Base URL 或网络代理。";
    }
    if (/(no image|no data|returned empty|没有返回图片)/i.test(text)) {
        return "模型供应商没有返回图片结果，请换个提示词或稍后重试。";
    }
    return text;
}

export const request = axios.create({
    baseURL: webConfig.apiUrl.replace(/\/$/, ""),
    withCredentials: true,
});

request.interceptors.request.use(async (config) => {
    const nextConfig = {...config};
    const authKey = await getStoredAuthKey();
    const headers = {...(nextConfig.headers || {})} as Record<string, string>;
    if (authKey && !headers.Authorization) {
        headers.Authorization = `Bearer ${authKey}`;
    }
    nextConfig.withCredentials = true;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    nextConfig.headers = headers;
    return nextConfig;
});

request.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ErrorPayload>) => {
        const status = error.response?.status;
        const shouldRedirect = (error.config as RequestConfig | undefined)?.redirectOnUnauthorized !== false;
        if (status === 401 && shouldRedirect && typeof window !== "undefined") {
            // Avoid redirect loop — only redirect if not already on /login
            if (!window.location.pathname.startsWith("/login")) {
                await clearStoredAuthSession();
                window.location.replace("/login");
                // Return a never-resolving promise to prevent further error handling
                // while the browser navigates away
                return new Promise(() => {});
            }
        }

        const payload = error.response?.data;
        const message =
            errorMessageFromValue(payload?.detail) ||
            errorMessageFromValue(payload?.error) ||
            payload?.message ||
            error.message ||
            `请求失败 (${status || 500})`;
        return Promise.reject(new Error(humanizeRequestError(message)));
    },
);

type RequestOptions = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    redirectOnUnauthorized?: boolean;
};

export async function httpRequest<T>(path: string, options: RequestOptions = {}) {
    const {method = "GET", body, headers, redirectOnUnauthorized = true} = options;
    const config: RequestConfig = {
        url: path,
        method,
        data: body,
        headers,
        redirectOnUnauthorized,
    };
    const response = await request.request<T>(config);
    return response.data;
}
