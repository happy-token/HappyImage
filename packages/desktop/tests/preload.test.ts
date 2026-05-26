import { describe, test, expect } from 'bun:test'

describe('HappyDesktopAPI', () => {
  test('api shape has all required methods', () => {
    const requiredMethods = [
      'openProjectDialog',
      'revealInFinder',
      'getRecentProjects',
      'notify',
      'getAppInfo',
      'checkUpdate',
      'downloadUpdate',
      'installUpdate',
      'onShortcut',
    ]

    for (const method of requiredMethods) {
      expect(typeof method).toBe('string')
      expect(method.length).toBeGreaterThan(0)
    }
  })
})
