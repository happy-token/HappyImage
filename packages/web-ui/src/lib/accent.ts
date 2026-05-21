const accentPalettes: Record<string, Record<number | string, string>> = {
  indigo: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
    950: '#4c0519',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  cyan: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
    950: '#083344',
  },
  violet: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
    950: '#2e1065',
  },
}

let accentStyle: HTMLStyleElement | null = null

export function applyAccent(color: string) {
  const p = accentPalettes[color] || accentPalettes.indigo

  if (!accentStyle) {
    accentStyle = document.createElement('style')
    accentStyle.id = 'accent-override'
    document.head.appendChild(accentStyle)
  }

  // Inject dynamic Tailwind v4 CSS variables for dark and light themes
  accentStyle.textContent = `
    [data-theme="dark"] {
      --color-indigo-50: ${p[50]};
      --color-indigo-100: ${p[100]};
      --color-indigo-200: ${p[200]};
      --color-indigo-300: ${p[300]};
      --color-indigo-400: ${p[400]};
      --color-indigo-500: ${p[500]};
      --color-indigo-600: ${p[600]};
      --color-indigo-700: ${p[700]};
      --color-indigo-800: ${p[800]};
      --color-indigo-900: ${p[900]};
      --color-indigo-950: ${p[950]};

      --color-accent: ${p[500]};
      --color-accent-light: ${p[400]};
      --color-accent-dark: ${p[600]};
    }

    [data-theme="light"] {
      --color-indigo-50: ${p[50]};
      --color-indigo-100: ${p[100]};
      --color-indigo-200: ${p[200]};
      --color-indigo-300: ${p[700]}; /* light text becomes readable dark text */
      --color-indigo-400: ${p[600]}; /* light text becomes readable dark text */
      --color-indigo-500: ${p[600]}; /* middle-rich button */
      --color-indigo-600: ${p[700]}; /* middle-rich button bg */
      --color-indigo-700: ${p[800]}; /* button hover state */
      --color-indigo-800: ${p[200]}; /* dark bg becomes light bg */
      --color-indigo-900: ${p[100]}; /* dark bg becomes light bg */
      --color-indigo-950: ${p[50]};  /* darkest bg becomes light bg */

      --color-accent: ${p[600]};
      --color-accent-light: ${p[500]};
      --color-accent-dark: ${p[700]};
    }
  `
}
