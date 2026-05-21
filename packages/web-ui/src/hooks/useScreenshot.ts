import { getScreenshotPath, getStyleGradient } from '../lib/screenshots'

export function useScreenshot(skillId: string, dimension: string, itemId: string) {
  const path = getScreenshotPath(skillId, dimension, itemId)
  const fallback = getStyleGradient(itemId)
  return { path, fallback }
}
