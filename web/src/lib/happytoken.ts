export const HAPPYTOKEN_HOME_URL =
  process.env.NEXT_PUBLIC_HAPPYTOKEN_HOME_URL || "https://happy-token.cn";
export const HAPPYTOKEN_GATEWAY_URL = "https://gateway.happy-token.cn";
export const HAPPYTOKEN_TOPUP_PATH = "/wallet";

export type HappyTokenSsoTarget = "/dashboard" | "/wallet";
export type HappyTokenSsoLanguage = "zh" | "en";

const BILLING_ERROR_PATTERN =
  /(insufficient_quota|quota|credit|credits|balance|billing|payment required|recharge|余额|额度|欠费|充值)/i;

function normalizeBaseUrl(value?: string) {
  return String(value || HAPPYTOKEN_GATEWAY_URL)
    .trim()
    .replace(/\/+$/, "");
}

export function buildHappyTokenTopupUrl(managementUrl?: string) {
  const baseUrl = normalizeBaseUrl(managementUrl);
  try {
    return new URL(HAPPYTOKEN_TOPUP_PATH, `${baseUrl}/`).toString();
  } catch {
    return `${HAPPYTOKEN_GATEWAY_URL}${HAPPYTOKEN_TOPUP_PATH}`;
  }
}

export function buildHappyTokenSsoUrl(
  target: HappyTokenSsoTarget,
  language: HappyTokenSsoLanguage = "zh"
) {
  const url = new URL("/sso", HAPPYTOKEN_GATEWAY_URL);
  url.searchParams.set("next", target);
  url.searchParams.set("lang", language);
  return url.toString();
}

export function isHappyTokenBillingError(message: unknown) {
  return BILLING_ERROR_PATTERN.test(String(message || ""));
}
