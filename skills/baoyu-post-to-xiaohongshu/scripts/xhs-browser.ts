import fs from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  CdpConnection,
  findChromeExecutable,
  findExistingChromeDebugPort,
  getDefaultProfileDir,
  killChromeByProfile,
  launchChrome as launchXhsChrome,
  sleep,
  waitForChromeDebugPort,
} from './xhs-utils.js';

const XHS_PUBLISH_URL = 'https://creator.xiaohongshu.com/publish/publish';
const MAX_IMAGES = 18;

interface XhsBrowserOptions {
  text?: string;
  images?: string[];
  timeoutMs?: number;
  profileDir?: string;
  chromePath?: string;
}

// Robust caption parser for Xiaohongshu
function parseXiaohongshuCaption(text: string): { title: string; body: string } {
  const normalizedText = text.replace(/\\n/g, '\n');
  const lines = normalizedText.trim().split('\n');
  if (lines.length === 0) return { title: '', body: '' };

  let title = '';
  let bodyStartIndex = 0;

  const firstLine = lines[0].trim();
  if (firstLine.startsWith('# ')) {
    title = firstLine.replace(/^#\s+/, '');
    bodyStartIndex = 1;
  } else if (firstLine.startsWith('【') && firstLine.includes('】')) {
    const endBracketIdx = firstLine.indexOf('】');
    title = firstLine.slice(1, endBracketIdx).trim();
    const rest = firstLine.slice(endBracketIdx + 1).trim();
    if (rest) {
      lines[0] = rest;
      bodyStartIndex = 0;
    } else {
      bodyStartIndex = 1;
    }
  } else {
    // If first line is reasonably short, treat as title
    if (firstLine.length < 40) {
      title = firstLine;
      bodyStartIndex = 1;
    } else {
      title = '';
      bodyStartIndex = 0;
    }
  }

  const body = lines.slice(bodyStartIndex).join('\n').trim();
  return { title, body };
}

export async function postToXiaohongshu(options: XhsBrowserOptions): Promise<void> {
  const { text, images = [], timeoutMs = 180_000, profileDir = getDefaultProfileDir() } = options;

  if (images.length > MAX_IMAGES) {
    throw new Error(`Too many images: ${images.length} (max ${MAX_IMAGES})`);
  }

  await mkdir(profileDir, { recursive: true });

  const chromePath = findChromeExecutable(options.chromePath);
  if (!chromePath) throw new Error('Chrome not found. Set XHS_BROWSER_CHROME_PATH env var.');

  let port: number;
  const existingPort = await findExistingChromeDebugPort(profileDir);

  if (existingPort) {
    console.log(`[xhs-post] Found existing Chrome on port ${existingPort}, checking health...`);
    try {
      const wsUrl = await waitForChromeDebugPort(existingPort, 5_000);
      const testCdp = await CdpConnection.connect(wsUrl, 5_000, { defaultTimeoutMs: 5_000 });
      await testCdp.send('Target.getTargets');
      testCdp.close();
      console.log('[xhs-post] Existing Chrome is responsive, reusing.');
      port = existingPort;
    } catch {
      console.log('[xhs-post] Existing Chrome unresponsive, restarting...');
      killChromeByProfile(profileDir);
      await sleep(2000);
      port = await launchXhsChrome(XHS_PUBLISH_URL, profileDir, chromePath);
    }
  } else {
    port = await launchXhsChrome(XHS_PUBLISH_URL, profileDir, chromePath);
  }

  let cdp: CdpConnection | null = null;

  try {
    const wsUrl = await waitForChromeDebugPort(port, 30_000);
    cdp = await CdpConnection.connect(wsUrl, 30_000, { defaultTimeoutMs: 15_000 });

    // Bring Google Chrome window to the front on macOS
    if (process.platform === 'darwin') {
      try {
        const { exec } = await import('node:child_process');
        exec(`osascript -e 'tell application "Google Chrome" to activate'`);
      } catch (e) {
        // Ignore
      }
    }

    const targets = await cdp.send<{ targetInfos: Array<{ targetId: string; url: string; type: string }> }>('Target.getTargets');
    let pageTarget = targets.targetInfos.find((t) => t.type === 'page' && t.url.includes('creator.xiaohongshu.com'));

    if (!pageTarget) {
      const { targetId } = await cdp.send<{ targetId: string }>('Target.createTarget', { url: XHS_PUBLISH_URL });
      pageTarget = { targetId, url: XHS_PUBLISH_URL, type: 'page' };
    }

    const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });

    await cdp.send('Target.activateTarget', { targetId: pageTarget.targetId });

    await cdp.send('Page.enable', {}, { sessionId });
    await cdp.send('Runtime.enable', {}, { sessionId });
    await cdp.send('Input.setIgnoreInputEvents', { ignore: false }, { sessionId });

    const currentUrl = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true,
    }, { sessionId });

    if (!currentUrl.result.value.includes('creator.xiaohongshu.com/publish/publish')) {
      console.log('[xhs-post] Navigating to Xiaohongshu publish note page...');
      await cdp.send('Page.navigate', { url: XHS_PUBLISH_URL }, { sessionId });
      await sleep(3000);
    }

    console.log('[xhs-post] Waiting for Xiaohongshu publisher dashboard...');
    await sleep(3000);

    const checkPublishPageLoaded = async (): Promise<boolean> => {
      try {
        const result = await cdp!.send<{ result: { value: { loaded: boolean; url: string; hasTitle: boolean; hasEditor: boolean; hasFileInput: boolean } } }>('Runtime.evaluate', {
          expression: `
            (() => {
              const url = window.location.href;
              const hasTitle = !!(
                document.querySelector('input[placeholder="填写标题，可能会有更多赞哦"]') ||
                document.querySelector('input[placeholder*="标题"]') ||
                document.querySelector('.title-input input') ||
                document.querySelector('input.el-input__inner')
              );
              const hasEditor = !!(
                document.querySelector('.ql-editor') ||
                document.querySelector('div[contenteditable="true"]') ||
                document.querySelector('textarea[placeholder*="正文"]')
              );
              const hasFileInput = !!document.querySelector('input[type="file"]');
              
              // Consider it loaded if we are on the publish URL and have at least the title or editor or file input
              const isPublishUrl = url.includes('/publish/publish');
              const loaded = isPublishUrl && (hasTitle || hasEditor || hasFileInput);
              
              return { loaded, url, hasTitle, hasEditor, hasFileInput };
            })()
          `,
          returnByValue: true,
        }, { sessionId }).catch(() => ({ result: { value: { loaded: false, url: '', hasTitle: false, hasEditor: false, hasFileInput: false } } }));

        const val = result.result.value;
        if (val.loaded) {
          return true;
        }
        console.log(`[xhs-post-debug] Page state: URL="${val.url}", hasTitle=${val.hasTitle}, hasEditor=${val.hasEditor}, hasFileInput=${val.hasFileInput}`);
        return false;
      } catch (err) {
        return false;
      }
    };

    const checkLoggedInButNotOnPublishPage = async (): Promise<boolean> => {
      try {
        const result = await cdp!.send<{ result: { value: boolean } }>('Runtime.evaluate', {
          expression: `
            (() => {
              const url = window.location.href;
              if (url.includes('/creator/home') || url.includes('/creator/dashboard') || url.includes('/creator/')) {
                if (!url.includes('/publish/publish')) {
                  return true;
                }
              }
              // Check for sidebar or user info indicating we are logged in on a home page
              if (document.querySelector('.side-bar') || document.querySelector('.menu-container') || document.querySelector('.user-info')) {
                if (!document.querySelector('input[placeholder*="标题"]') && !document.querySelector('.ql-editor')) {
                  return true;
                }
              }
              return false;
            })()
          `,
          returnByValue: true,
        }, { sessionId }).catch(() => ({ result: { value: false } }));
        return result.result.value;
      } catch (err) {
        return false;
      }
    };

    const isLoaded = await checkPublishPageLoaded();
    if (!isLoaded) {
      console.log('[xhs-post] Publisher form not found. You might need to log in.');
      console.log('[xhs-post] Please log in to Xiaohongshu in the browser window.');
      console.log('[xhs-post] Waiting for login / page navigation...');

      // Trigger macOS System Notification
      if (process.platform === 'darwin') {
        try {
          const notifyCmd = `osascript -e 'display notification "请在弹出的浏览器中登录小红书账号" with title "小红书发布提示" subtitle "需要登录以自动填充内容"'`;
          const { exec } = await import('node:child_process');
          exec(notifyCmd);
        } catch (e) {
          // Ignore
        }
      }

      // Inject floating notice in the browser page
      try {
        await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            if (document.getElementById('happyimage-login-notice')) return;
            const div = document.createElement('div');
            div.id = 'happyimage-login-notice';
            div.style.position = 'fixed';
            div.style.top = '0';
            div.style.left = '0';
            div.style.width = '100%';
            div.style.backgroundColor = '#fbbf24';
            div.style.color = '#78350f';
            div.style.textAlign = 'center';
            div.style.padding = '14px 20px';
            div.style.fontSize = '15px';
            div.style.fontWeight = 'bold';
            div.style.zIndex = '999999';
            div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            div.style.borderBottom = '2px solid #d97706';
            div.style.fontFamily = 'system-ui, sans-serif';
            div.innerText = '⚠️ HappyImage 提示：检测到未登录，请扫码或验证码登录。登录成功后将自动为你填充标题、描述和上传图片！';
            document.body.appendChild(div);
          })()`,
        }, { sessionId }).catch(() => {});
      } catch (err) {
        // Ignore
      }

      const start = Date.now();
      let loggedIn = false;
      while (Date.now() - start < timeoutMs) {
        if (await checkPublishPageLoaded()) {
          loggedIn = true;
          break;
        }

        // If logged in but on dashboard homepage, auto-redirect back to publish page
        if (await checkLoggedInButNotOnPublishPage()) {
          console.log('[xhs-post] Detected successful login on home page! Redirecting back to publish page...');
          await cdp.send('Page.navigate', { url: XHS_PUBLISH_URL }, { sessionId }).catch(() => {});
          await sleep(3000);
        }

        // Re-inject notice if page changes/refreshes during login process (only on login pages)
        try {
          const isCurrentlyOnLogin = await cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
            expression: `window.location.href.includes('/login')`,
            returnByValue: true,
          }, { sessionId }).catch(() => ({ result: { value: false } }));

          if (isCurrentlyOnLogin.result.value) {
            await cdp.send('Runtime.evaluate', {
              expression: `(() => {
                if (document.getElementById('happyimage-login-notice')) return;
                const div = document.createElement('div');
                div.id = 'happyimage-login-notice';
                div.style.position = 'fixed';
                div.style.top = '0';
                div.style.left = '0';
                div.style.width = '100%';
                div.style.backgroundColor = '#fbbf24';
                div.style.color = '#78350f';
                div.style.textAlign = 'center';
                div.style.padding = '14px 20px';
                div.style.fontSize = '15px';
                div.style.fontWeight = 'bold';
                div.style.zIndex = '999999';
                div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                div.style.borderBottom = '2px solid #d97706';
                div.style.fontFamily = 'system-ui, sans-serif';
                div.innerText = '⚠️ HappyImage 提示：检测到未登录，请扫码或验证码登录。登录成功后将自动为你填充标题、描述和上传图片！';
                document.body.appendChild(div);
              })()`,
            }, { sessionId }).catch(() => {});
          }
        } catch {
          // Ignore
        }
        await sleep(1500);
      }
      if (!loggedIn) throw new Error('Timed out waiting for Xiaohongshu publish note page. Please login first.');
    }

    // Switch to "上传图文" (Upload Image/Text) tab
    console.log('[xhs-post] Switching to "上传图文" (Upload Image/Text) tab...');
    await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const tabs = Array.from(document.querySelectorAll('.creator-tab'));
        const matchingTabs = tabs.filter(t => t.textContent.includes('上传图文') || t.textContent.includes('图文'));
        matchingTabs.forEach(t => {
          t.click();
          const span = t.querySelector('span');
          if (span) span.click();
        });
      })()`
    }, { sessionId }).catch(() => {});
    await sleep(2000); // Wait for tab DOM elements to render

    const waitForSelector = async (selectors: string[], timeoutMs = 10000): Promise<boolean> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const result = await cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
            expression: `(() => {
              const el = ${selectors.map(sel => `document.querySelector(${JSON.stringify(sel)})`).join(' || ')};
              return !!el;
            })()`,
            returnByValue: true
          }, { sessionId }).catch(() => ({ result: { value: false } }));
          
          if (result.result.value) return true;
        } catch {
          // Ignore
        }
        await sleep(500);
      }
      return false;
    };

    const { title, body } = parseXiaohongshuCaption(text || '');
    console.log(`[xhs-post] Parsed title: "${title}"`);
    console.log(`[xhs-post] Parsed body length: ${body.length} chars`);

    // 1. Upload Images FIRST (which triggers transition to editor layout)
    if (images.length > 0) {
      const missing = images.filter((f) => !fs.existsSync(f));
      if (missing.length > 0) {
        throw new Error(`Images not found: ${missing.join(', ')}`);
      }

      console.log('[xhs-post] Waiting for file input...');
      const fileInputSelectors = [
        'input[type="file"][accept*="image"]',
        'input[type="file"]'
      ];
      const fileInputReady = await waitForSelector(fileInputSelectors, 10000);
      if (fileInputReady) {
        const absolutePaths = images.map((f) => path.resolve(f));
        console.log(`[xhs-post] Uploading ${absolutePaths.length} image(s) via file input...`);

        await cdp.send('DOM.enable', {}, { sessionId });
        const { root } = await cdp.send<{ root: { nodeId: number } }>('DOM.getDocument', {}, { sessionId });

        let nodeId = 0;
        for (const selector of fileInputSelectors) {
          try {
            const res = await cdp.send<{ nodeId: number }>('DOM.querySelector', {
              nodeId: root.nodeId,
              selector,
            }, { sessionId });
            if (res.nodeId && res.nodeId !== 0) {
              nodeId = res.nodeId;
              break;
            }
          } catch {
            // Ignore
          }
        }

        if (nodeId && nodeId !== 0) {
          await cdp.send('DOM.setFileInputFiles', {
            nodeId,
            files: absolutePaths,
          }, { sessionId });

          console.log('[xhs-post] Images set on file input. Waiting for editor layout to render...');
          await sleep(5000); // Wait for upload and layout switch
        } else {
          console.warn('[xhs-post] WARNING: File input element not found after wait.');
        }
      } else {
        console.warn('[xhs-post] WARNING: File input element timed out.');
      }
    }

    // 2. Fill Title
    if (title) {
      console.log('[xhs-post] Waiting for title input field...');
      const titleSelectors = [
        'input[placeholder="填写标题，可能会有更多赞哦"]',
        'input[placeholder="填写标题会有更多赞哦"]',
        'input[placeholder*="标题"]',
        '.title-input input',
        'input.el-input__inner',
        '.c-input input',
        'input'
      ];
      const titleReady = await waitForSelector(titleSelectors, 15000);
      if (titleReady) {
        console.log('[xhs-post] Filling title...');
        const findTitleResult = await cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
          expression: `(() => {
            const el = ${titleSelectors.map(sel => `document.querySelector(${JSON.stringify(sel)})`).join(' || ')};
            if (el) {
              el.focus();
              el.value = '';
              el.dispatchEvent(new Event('input', { bubbles: true }));
              return true;
            }
            return false;
          })()`,
          returnByValue: true
        }, { sessionId }).catch(() => ({ result: { value: false } }));

        if (findTitleResult.result.value) {
          await sleep(200);
          await cdp.send('Input.insertText', { text: title }, { sessionId });
          await sleep(500);
          console.log('[xhs-post] Title filled successfully.');
        } else {
          console.warn('[xhs-post] WARNING: Title input element disappeared during execution.');
        }
      } else {
        console.warn('[xhs-post] WARNING: Title input field timed out.');
        const inputsInfo = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
          expression: `JSON.stringify(Array.from(document.querySelectorAll('input')).map(el => ({ placeholder: el.placeholder, className: el.className })))`,
          returnByValue: true
        }, { sessionId }).catch(() => ({ result: { value: '[]' } }));
        console.log(`[xhs-post-debug] Available inputs: ${inputsInfo.result.value}`);
      }
    }

    // 3. Fill Body/Description
    if (body) {
      console.log('[xhs-post] Waiting for description editor...');
      const contentSelectors = [
        '.tiptap.ProseMirror',
        '.ql-editor',
        'div[contenteditable="true"]',
        '#post-textarea',
        'textarea[placeholder*="正文"]',
        '.editor'
      ];
      const descReady = await waitForSelector(contentSelectors, 15000);
      if (descReady) {
        console.log('[xhs-post] Filling description...');
        const findDescResult = await cdp.send<{ result: { value: boolean } }>('Runtime.evaluate', {
          expression: `(() => {
            const el = ${contentSelectors.map(sel => `document.querySelector(${JSON.stringify(sel)})`).join(' || ')};
            if (el) {
              el.focus();
              return true;
            }
            return false;
          })()`,
          returnByValue: true
        }, { sessionId }).catch(() => ({ result: { value: false } }));

        if (findDescResult.result.value) {
          await sleep(200);
          await cdp.send('Runtime.evaluate', {
            expression: `(() => {
              const el = ${contentSelectors.map(sel => `document.querySelector(${JSON.stringify(sel)})`).join(' || ')};
              if (el) {
                try { el.innerHTML = ''; } catch(e) {}
                return true;
              }
              return false;
            })()`,
            returnByValue: true
          }, { sessionId }).catch(() => ({ result: { value: false } }));

          await cdp.send('Input.insertText', { text: body }, { sessionId });
          await sleep(500);
          console.log('[xhs-post] Description filled successfully.');
        } else {
          console.warn('[xhs-post] WARNING: Description editor element disappeared during execution.');
        }
      } else {
        console.warn('[xhs-post] WARNING: Description editor element timed out.');
        const textareasInfo = await cdp.send<{ result: { value: string } }>('Runtime.evaluate', {
          expression: `JSON.stringify(Array.from(document.querySelectorAll(\'[contenteditable="true"], textarea, div[class*="editor"]\')).map(el => ({ tag: el.tagName, className: el.className, placeholder: el.placeholder || el.getAttribute("placeholder") })))`,
          returnByValue: true
        }, { sessionId }).catch(() => ({ result: { value: '[]' } }));
        console.log(`[xhs-post-debug] Available editors/textareas: ${textareasInfo.result.value}`);
      }
    }

    console.log('\n===============================================================');
    console.log('[xhs-post] L1 Semi-Automation Complete!');
    console.log('[xhs-post] Title, description, and images are populated.');
    console.log('[xhs-post] PLEASE REVIEW AND CLICK THE "PUBLISH" (发布) BUTTON MANUALLY.');
    console.log('===============================================================\n');

  } finally {
    if (cdp) {
      cdp.close();
    }
  }
}

function printUsage(): never {
  console.log(`Post to Xiaohongshu (Little Red Book) Creator Platform using L1 browser automation

Usage:
  npx -y bun xhs-browser.ts [options] [text]

Options:
  --image <path>   Add image (can be repeated, max 18)
  --profile <dir>  Chrome profile directory
  --help           Show this help

Examples:
  npx -y bun xhs-browser.ts "# My Title\\nThis is the content" --image a.png --image b.png
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();

  const images: string[] = [];
  let profileDir: string | undefined;
  const textParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--image' && args[i + 1]) {
      images.push(args[++i]!);
    } else if (arg === '--profile' && args[i + 1]) {
      profileDir = args[++i];
    } else if (!arg.startsWith('-')) {
      textParts.push(arg);
    }
  }

  const text = textParts.join(' ').trim() || undefined;

  if (!text && images.length === 0) {
    console.error('Error: Provide text or at least one image.');
    process.exit(1);
  }

  await postToXiaohongshu({ text, images, profileDir });
}

await main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
