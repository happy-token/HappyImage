import { describe, expect, it } from "vitest";

import {
  buildHappyTokenSsoUrl,
  buildHappyTokenTopupUrl,
  HAPPYTOKEN_HOME_URL,
} from "./happytoken";

describe("HappyToken product links", () => {
  it("uses the public website as the default home", () => {
    expect(HAPPYTOKEN_HOME_URL).toBe("https://happy-token.cn");
  });

  it("routes console and wallet access through the unified SSO entry", () => {
    expect(buildHappyTokenSsoUrl("/dashboard", "zh")).toBe(
      "https://gateway.happy-token.cn/sso?next=%2Fdashboard&lang=zh"
    );
    expect(buildHappyTokenSsoUrl("/wallet", "en")).toBe(
      "https://gateway.happy-token.cn/sso?next=%2Fwallet&lang=en"
    );
  });

  it("uses the gateway wallet route for direct top-up links", () => {
    expect(buildHappyTokenTopupUrl()).toBe(
      "https://gateway.happy-token.cn/wallet"
    );
  });
});
