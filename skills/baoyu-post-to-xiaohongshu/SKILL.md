---
name: baoyu-post-to-xiaohongshu
description: Posts content (text and images) to Xiaohongshu (Little Red Book) Creator Platform using L1 level browser automation.
version: 1.0.0
metadata:
  openclaw:
    homepage: https://github.com/JimLiu/baoyu-skills#baoyu-post-to-xiaohongshu
    requires:
      anyBins:
        - bun
        - npx
---

# Post to Xiaohongshu (L1 Semi-Automated)

This skill automates the process of publishing text and images to the Xiaohongshu Creator Dashboard.

## Features

- Launches a real Chrome instance using a designated Chrome user profile.
- Opens the Xiaohongshu creator dashboard publish note page (`https://creator.xiaohongshu.com/publish/publish-note`).
- Detects if the user is logged in, and waits for login if needed.
- Parses input markdown caption to extract the title and post content.
- Populates the title and description/text fields.
- Uploads images using Chrome DevTools Protocol (CDP) file input interaction.
- Leaves the browser open for the user to review, edit, and click the final "Publish" button manually to prevent platform anti-bot risk control triggers.

## Configuration

Set the environment variables or preferences:
- `XHS_BROWSER_PROFILE_DIR`: Optional Chrome profile directory. Defaults to standard shared profile paths.
- `XHS_BROWSER_CHROME_PATH`: Optional custom Chrome executable path.

## Usage

```bash
bun run xhs-browser.ts "Caption text" --image ./path/to/img.png --profile /path/to/profile
```
