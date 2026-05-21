let themeStyle: HTMLStyleElement | null = null

const darkCSS = `
:root {
  /* Slate variables for dark mode (zinc-based) */
  --color-slate-50: #09090b;
  --color-slate-100: #18181b;
  --color-slate-200: #27272a;
  --color-slate-300: #3f3f46;
  --color-slate-400: #52525b;
  --color-slate-500: #71717a;
  --color-slate-600: #a1a1aa;
  --color-slate-700: #d4d4d8;
  --color-slate-800: #e4e4e7;
  --color-slate-900: #f4f4f5;
  --color-slate-950: #fafafa;

  /* Zinc variables for dark mode */
  --color-zinc-50: #fafafa;
  --color-zinc-100: #f4f4f5;
  --color-zinc-200: #e4e4e7;
  --color-zinc-300: #d4d4d8;
  --color-zinc-400: #a1a1aa;
  --color-zinc-500: #71717a;
  --color-zinc-600: #52525b;
  --color-zinc-700: #3f3f46;
  --color-zinc-800: #27272a;
  --color-zinc-900: #18181b;
  --color-zinc-950: #09090b;

  /* Custom/non-standard shades */
  --color-zinc-150: #e4e4e7;
  --color-zinc-250: #d4d4d8;
  --color-zinc-350: #a1a1aa;
  --color-zinc-550: #71717a;
  --color-zinc-650: #52525b;
  --color-zinc-750: #3f3f46;
  --color-zinc-850: #27272a;

  /* Cream variables for dark mode */
  --color-cream-50: #18181b;
  --color-cream-100: #27272a;
  --color-cream-200: #3f3f46;
  --color-cream-300: #52525b;
  --color-cream-400: #71717a;
}
`

const lightCSS = `
:root {
  /* Slate variables for light mode */
  --color-slate-50: #f7f4ec;
  --color-slate-100: #f5f0e8;
  --color-slate-200: #ebe4d8;
  --color-slate-300: #dcd3c4;
  --color-slate-400: #c4b9a6;
  --color-slate-500: #94a3b8;
  --color-slate-600: #64748b;
  --color-slate-700: #475569;
  --color-slate-800: #334155;
  --color-slate-900: #1e293b;
  --color-slate-950: #0f172a;

  /* Zinc variables for light mode (invert dark-native pages to light) */
  --color-zinc-950: #f7f4ec;
  --color-zinc-900: #fffdf7;
  --color-zinc-800: #f5f0e8;
  --color-zinc-700: #ebe4d8;
  --color-zinc-600: #dcd3c4;
  --color-zinc-500: #94a3b8;
  --color-zinc-400: #64748b;
  --color-zinc-300: #475569;
  --color-zinc-200: #334155;
  --color-zinc-100: #1e293b;
  --color-zinc-5: #0f172a; /* Note: originally zinc-50 was mapped here, let's keep zinc-50 */
  --color-zinc-50: #0f172a;

  /* Custom/non-standard shades */
  --color-zinc-150: #1e293b;
  --color-zinc-250: #334155;
  --color-zinc-350: #475569;
  --color-zinc-550: #94a3b8;
  --color-zinc-650: #475569;
  --color-zinc-750: #dcd3c4;
  --color-zinc-850: #f5f0e8;

  /* Cream variables for light mode */
  --color-cream-50: #faf8f5;
  --color-cream-100: #F5F0E8;
  --color-cream-200: #ebe4d8;
  --color-cream-300: #dcd3c4;
  --color-cream-400: #c4b9a6;

  /* Soft light-mode status badge color overrides */
  --color-emerald-950: #10b981;
  --color-emerald-400: #047857;
  --color-emerald-900: #a7f3d0;

  --color-amber-950: #f59e0b;
  --color-amber-400: #b45309;
  --color-amber-900: #fde68a;
}
`

let systemMediaListener: ((e: MediaQueryListEvent) => void) | null = null

export function applyTheme(mode: string) {
  if (!themeStyle) {
    themeStyle = document.createElement('style')
    themeStyle.id = 'theme-override'
    document.head.appendChild(themeStyle)
  }

  // Clean up any existing listener
  if (systemMediaListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemMediaListener)
    systemMediaListener = null
  }

  let activeMode = mode
  if (mode === 'system') {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    activeMode = media.matches ? 'dark' : 'light'
    
    systemMediaListener = () => {
      // Re-apply to update when system preference changes
      applyTheme('system')
    }
    media.addEventListener('change', systemMediaListener)
  }

  document.documentElement.dataset.theme = activeMode
  document.documentElement.classList.toggle('dark', activeMode === 'dark')
  if (activeMode === 'dark') {
    themeStyle.textContent = darkCSS
  } else if (activeMode === 'light') {
    themeStyle.textContent = lightCSS
  } else {
    themeStyle.textContent = ''
  }
}
