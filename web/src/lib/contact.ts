export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";
export const SUPPORT_WECHAT = process.env.NEXT_PUBLIC_SUPPORT_WECHAT || "HappyTokenAI";
export const SUPPORT_WECHAT_QR = "/contact/wechat_qr.png";
// 从上面那张卡片图裁出的纯二维码（658x658），用于需要小尺寸展示的位置
export const SUPPORT_WECHAT_QR_CODE = "/contact/wechat_qr_code.png";

export type SupportContext = {
  error?: string;
  taskId?: string;
};

/**
 * 生成可直接粘贴到微信的故障说明，替代原先 mailto 的邮件正文。
 */
export function buildSupportMessage({ error, taskId }: SupportContext): string {
  return [
    "我在 HappyImage 生成图片时遇到失败。",
    "",
    `错误信息：${error || "生成失败"}`,
    `任务 ID：${taskId || "-"}`,
  ].join("\n");
}
