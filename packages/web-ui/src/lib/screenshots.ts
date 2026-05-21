const SCREENSHOT_BASE = '/screenshots'

const KNOWN_SCREENSHOTS: Record<string, string[]> = {}

export function getScreenshotUrl(dir: string, itemId: string): string | null {
  const key = `${dir}/${itemId}`
  if (KNOWN_SCREENSHOTS[key] !== undefined) {
    return KNOWN_SCREENSHOTS[key] ? `${SCREENSHOT_BASE}/${dir}/${itemId}.webp` : null
  }
  return `${SCREENSHOT_BASE}/${dir}/${itemId}.webp`
}

export function getScreenshotPath(skillId: string, dimension: string, itemId: string): string | null {
  const dirMap: Record<string, Record<string, string>> = {
    'image-cards': { style: 'xhs-images-styles', layout: 'xhs-images-layouts' },
    'infographic': { style: 'infographic-styles', layout: 'infographic-layouts' },
    'cover-image': { style: 'cover-image-styles' },
    'slide-deck': { style: 'slide-deck-styles' },
    'comic': { art: 'comic-styles', tone: 'comic-styles', layout: 'comic-layouts' },
    'article-illustrator': { style: 'article-illustrator-styles' },
  }

  const skillDirs = dirMap[skillId]
  if (!skillDirs) return null

  const dir = skillDirs[dimension]
  if (!dir) return null

  return getScreenshotUrl(dir, itemId)
}

export function getPaletteGradient(paletteId: string): string {
  const gradients: Record<string, string> = {
    macaron: 'linear-gradient(135deg, #A8D8EA 0%, #D5C6E0 30%, #B5E5CF 60%, #F8D5C4 100%)',
    warm: 'linear-gradient(135deg, #ED8936 0%, #C05621 30%, #F6AD55 60%, #D4A09A 100%)',
    neon: 'linear-gradient(135deg, #00F5FF 0%, #FF00FF 30%, #39FF14 60%, #FF6EC7 100%)',
    elegant: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 80%, #e94560 100%)',
    cool: 'linear-gradient(135deg, #0c2461 0%, #1e3799 40%, #4a69bd 80%, #6a89cc 100%)',
    dark: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #2d2d44 100%)',
    earth: 'linear-gradient(135deg, #5c4033 0%, #8b7355 40%, #c4a882 80%, #d4c4a8 100%)',
    vivid: 'linear-gradient(135deg, #ff6b35 0%, #f7c948 30%, #00b4d8 60%, #9b5de5 100%)',
    pastel: 'linear-gradient(135deg, #ffd6e0 0%, #e2f0cb 30%, #b8e8f0 60%, #d4c5f0 100%)',
    mono: 'linear-gradient(135deg, #1a1a1a 0%, #4a4a4a 50%, #8a8a8a 100%)',
    retro: 'linear-gradient(135deg, #e07a5f 0%, #f4d06f 30%, #81b29a 60%, #3d405b 100%)',
    duotone: 'linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%)',
    default: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  }
  return gradients[paletteId] || gradients.default
}

export function getStyleGradient(styleId: string): string {
  const gradients: Record<string, string> = {
    cute: 'linear-gradient(135deg, #fbc2eb 0%, #ffd1e8 40%, #ffe0f0 100%)',
    fresh: 'linear-gradient(135deg, #a8e6cf 0%, #dcedc1 50%, #ffd3b6 100%)',
    bold: 'linear-gradient(135deg, #ff4444 0%, #ff6b35 40%, #f7c948 100%)',
    minimal: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 50%, #bdbdbd 100%)',
    retro: 'linear-gradient(135deg, #e07a5f 0%, #f4d06f 50%, #81b29a 100%)',
    pop: 'linear-gradient(135deg, #ff6ec7 0%, #ffd700 30%, #00f5ff 60%, #ff00ff 100%)',
    notion: 'linear-gradient(135deg, #f5f0e8 0%, #e8e0d5 50%, #d5cdc0 100%)',
    chalkboard: 'linear-gradient(135deg, #2d5a27 0%, #3a7a33 50%, #1a3a15 100%)',
    'study-notes': 'linear-gradient(135deg, #fffde7 0%, #fff9c4 40%, #fff176 80%, #f5f0e8 100%)',
    'screen-print': 'linear-gradient(135deg, #1a1025 0%, #2d1b4e 50%, #ff4444 100%)',
    'sketch-notes': 'linear-gradient(135deg, #f5f0e8 0%, #A8D8EA 30%, #D5C6E0 60%, #F8D5C4 100%)',
    'craft-handmade': 'linear-gradient(135deg, #f5e6d3 0%, #e8d5b7 50%, #d4a574 100%)',
    claymation: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #a1c4fd 100%)',
    kawaii: 'linear-gradient(135deg, #ffd1e8 0%, #ffe0f0 40%, #e0f0ff 80%, #fff0f5 100%)',
    'storybook-watercolor': 'linear-gradient(135deg, #e8f4f8 0%, #d4e8f0 40%, #c8dce8 80%, #f0e8e0 100%)',
    'cyberpunk-neon': 'linear-gradient(135deg, #0a0020 0%, #1a0040 40%, #ff00ff 80%, #00ffff 100%)',
    'bold-graphic': 'linear-gradient(135deg, #ff4444 0%, #ffdd00 50%, #000000 100%)',
    'aged-academia': 'linear-gradient(135deg, #d4c5a9 0%, #c4b59a 50%, #a8947a 100%)',
    'corporate-memphis': 'linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 40%, #ffe66d 80%, #a8e6cf 100%)',
    'technical-schematic': 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #2d6a9f 100%)',
    origami: 'linear-gradient(135deg, #ff6b6b 0%, #ffa07a 40%, #ffd700 80%, #98fb98 100%)',
    'pixel-art': 'linear-gradient(135deg, #2d1b4e 0%, #4a2d7a 40%, #6b3fa0 80%, #9b5de5 100%)',
    'ui-wireframe': 'linear-gradient(135deg, #e0e0e0 0%, #cccccc 50%, #999999 100%)',
    'subway-map': 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)',
    'ikea-manual': 'linear-gradient(135deg, #fffde7 0%, #fff9c4 50%, #ffe082 100%)',
    knolling: 'linear-gradient(135deg, #f5f0e8 0%, #e8e0d5 50%, #d5cdc0 100%)',
    'lego-brick': 'linear-gradient(135deg, #ff4444 0%, #ffdd00 30%, #2196f3 60%, #4caf50 100%)',
    'pop-laboratory': 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 40%, #00b4d8 80%, #90e0ef 100%)',
    'morandi-journal': 'linear-gradient(135deg, #d4c5a9 0%, #c4b59a 40%, #b8a88a 80%, #f5f0e8 100%)',
    'retro-pop-grid': 'linear-gradient(135deg, #ff6b35 0%, #f7c948 30%, #00b4d8 60%, #ff006e 100%)',
    'hand-drawn-edu': 'linear-gradient(135deg, #f5f0e8 0%, #A8D8EA 30%, #D5C6E0 60%, #F8D5C4 100%)',
    'retro-popup-pop': 'linear-gradient(135deg, #ff006e 0%, #f7c948 30%, #00b4d8 60%, #8338ec 100%)',
    'ligne-claire': 'linear-gradient(135deg, #f5f0e8 0%, #e8e0d5 50%, #d5cdc0 100%)',
    manga: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)',
    realistic: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 80%, #e94560 100%)',
    'ink-brush': 'linear-gradient(135deg, #f5f0e8 0%, #d4c5a9 40%, #8b7355 80%, #2d1b00 100%)',
    chalk: 'linear-gradient(135deg, #2d5a27 0%, #3a7a33 50%, #1a3a15 100%)',
    minimalist: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 50%, #bdbdbd 100%)',
    blueprint: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #2d6a9f 100%)',
    editorial: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 50%, #e94560 100%)',
    scientific: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 50%, #d0d0d0 100%)',
    watercolor: 'linear-gradient(135deg, #e8f4f8 0%, #d4e8f0 40%, #f0e8e0 80%, #f5f0e8 100%)',
    'dark-atmospheric': 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 40%, #2d1b4e 80%, #4a2d7a 100%)',
    'bold-editorial': 'linear-gradient(135deg, #ff4444 0%, #ff6b35 40%, #f7c948 80%, #1a1a2e 100%)',
    'editorial-infographic': 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 40%, #00b4d8 80%, #f7c948 100%)',
    'fantasy-animation': 'linear-gradient(135deg, #ff6ec7 0%, #9b5de5 30%, #00f5ff 60%, #ffd700 100%)',
    'intuition-machine': 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 40%, #2d6a9f 80%, #00b4d8 100%)',
    'vector-illustration': 'linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 30%, #ffe66d 60%, #a8e6cf 100%)',
    vintage: 'linear-gradient(135deg, #d4c5a9 0%, #c4b59a 40%, #8b7355 80%, #5c4033 100%)',
    corporate: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 50%, #4a90d9 100%)',
  }
  return gradients[styleId] || gradients.default || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
}
