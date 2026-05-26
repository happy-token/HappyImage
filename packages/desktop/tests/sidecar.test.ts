import { describe, test, expect } from 'bun:test'
import { calculateBackoff, findAvailablePort, getPackagedResourcesPath } from '../src/sidecar.js'

describe('calculateBackoff', () => {
  test('returns 1000ms for attempt 0', () => {
    expect(calculateBackoff(0)).toBe(1000)
  })

  test('returns 2000ms for attempt 1', () => {
    expect(calculateBackoff(1)).toBe(2000)
  })

  test('returns 16000ms for attempt 4', () => {
    expect(calculateBackoff(4)).toBe(16000)
  })

  test('caps retries at 5', () => {
    expect(calculateBackoff(5)).toBe(32000)
  })
})

describe('findAvailablePort', () => {
  test('returns first port in array', () => {
    expect(findAvailablePort([3100])).toBe(3100)
  })
})

describe('getPackagedResourcesPath', () => {
  test('ignores Electron resources path when running through default app', () => {
    expect(getPackagedResourcesPath({
      defaultApp: true,
      resourcesPath: '/Electron.app/Contents/Resources',
    } as NodeJS.Process & { defaultApp?: boolean; resourcesPath?: string })).toBe('')
  })

  test('uses resources path in packaged app runtime', () => {
    expect(getPackagedResourcesPath({
      defaultApp: false,
      resourcesPath: '/Applications/HappyImage.app/Contents/Resources',
    } as NodeJS.Process & { defaultApp?: boolean; resourcesPath?: string })).toBe('/Applications/HappyImage.app/Contents/Resources')
  })
})
