import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SUPPORT_WECHAT_QR,
  SUPPORT_WECHAT_QR_CODE,
  buildSupportMessage,
} from "./contact";

const PUBLIC_DIR = fileURLToPath(new URL("../../public", import.meta.url));

describe("support contact", () => {
  it("ships the WeChat QR assets referenced by the UI", () => {
    for (const asset of [SUPPORT_WECHAT_QR, SUPPORT_WECHAT_QR_CODE]) {
      expect(asset.startsWith("/")).toBe(true);
      expect(existsSync(path.join(PUBLIC_DIR, asset))).toBe(true);
    }
  });

  it("includes the failure reason and task id in the WeChat message", () => {
    expect(
      buildSupportMessage({ error: "上游超时", taskId: "task_123" })
    ).toBe(
      [
        "我在 HappyImage 生成图片时遇到失败。",
        "",
        "错误信息：上游超时",
        "任务 ID：task_123",
      ].join("\n")
    );
  });

  it("falls back to placeholders when the failure details are missing", () => {
    const message = buildSupportMessage({});

    expect(message).toContain("错误信息：生成失败");
    expect(message).toContain("任务 ID：-");
  });

  it("keeps an empty error string from rendering an empty line", () => {
    expect(buildSupportMessage({ error: "" }).split("\n")[2]).toBe(
      "错误信息：生成失败"
    );
  });
});
