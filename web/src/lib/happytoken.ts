export const HAPPYTOKEN_GATEWAY_URL = "https://gateway.happy-token.cn";
export const HAPPYTOKEN_TOPUP_PATH = "/topup";

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

export function isHappyTokenBillingError(message: unknown) {
  return BILLING_ERROR_PATTERN.test(String(message || ""));
}
