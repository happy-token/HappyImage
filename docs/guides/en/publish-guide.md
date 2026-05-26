# HappyImage Publishing Guide

Multi-platform publishing instructions and troubleshooting.

## Platform Rules Quick Reference

| Platform | Max Images | Title Limit | Body Limit | Hashtags |
| :--- | :---: | :--- | :--- | :--- |
| **Xiaohongshu** | 18 | 20 chars | 1000 chars | Max 10, separate line at end |
| **Weibo** | 18 | inline 【title】 | 2000 chars (140 collapsed) | `#tag#` inline format |
| **X (Twitter)** | 4 | no title field | 280 chars | `#tag` inline format |
| **WeChat Official** | unlimited | 64 chars | 20000 chars | **not supported** |

## Publishing Flow

1. After generating images and copy, switch to the "Publish" tab
2. Select target platform
3. Click "Generate Caption" — AI creates platform-formatted copy
4. Review the platform preview mockup; click to edit copy directly
5. Click "Auto-Fill & Publish" — Chrome opens and auto-fills content
6. **Manual review**: The tool never clicks the final publish button. Verify in browser then publish manually.

## Session Management

Auto-publishing relies on your local Chrome browser login state. All platforms share one Chrome Profile.

- First use: Click each platform's QR login button in Settings. Scan QR — session auto-saves.
- Subsequent use: No re-login needed. Chrome reuses saved sessions.
- Storage path: `~/Library/Application Support/HappyImage/chrome-profile` (macOS)

When a session expires, a yellow banner appears at the top of the browser. Re-scan to continue.

## Platform Details

### Xiaohongshu
- URL: `creator.xiaohongshu.com/publish/publish`
- Auto-switches to "image+text" tab
- Recommended first image: 3:4 portrait

### Weibo
- URL: `weibo.com`
- Max 18 images
- 3-image layout: 1+2 special arrangement
- Supports long-form article mode

### X (Twitter)
- URL: `x.com/compose/post`
- Max 4 images
- Anti-detection clipboard-simulated paste for uploads
- Supports X Articles (Premium required)

### WeChat Official Account
- URL: `mp.weixin.com`
- Supports API (fast) and browser (requires Chrome) publishing
- Auto-converts Markdown to WeChat rich text
- Multi-account support via aliases

## Troubleshooting

**Q: Browser opened but content wasn't filled in?**
A: Session likely expired. Check for the yellow banner at browser top. Re-scan QR to continue.

**Q: Input fields have leftover text after auto-fill?**
A: The tool clears fields before filling, but some rich text editors cache content. Manually select-all and clear if overlap occurs.

**Q: How to configure WeChat account aliases?**
A: Settings → Publishing → WeChat Official Account Setup. Switch accounts in the publish panel dropdown.

**Q: Why does the preview show hashtag count as "inline"?**
A: For Weibo and X, hashtags are part of the body text (inline), not a separate field. "inline" means they count toward the character limit.

**Q: How to configure image watermarks?**
A: Settings → Preferences → Skill Preferences. Select the skill and edit watermark text, position, and opacity.
