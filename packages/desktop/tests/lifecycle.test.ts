import { describe, test, expect, mock } from 'bun:test'
import { createLifecycle, type LifecycleHooks } from '../src/lifecycle.js'

function createMockApp() {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {}
  return {
    on: mock((event: string, fn: (...args: any[]) => void) => {
      (handlers[event] ??= []).push(fn)
    }),
    trigger: (event: string, ...args: any[]) => {
      handlers[event]?.forEach(fn => fn(...args))
    },
    requestSingleInstanceLock: mock(() => true),
    quit: mock(() => {}),
  }
}

describe('lifecycle', () => {
  test('calls onReady when app fires ready event', () => {
    const app = createMockApp()
    let readyCalled = false

    createLifecycle(app as any, {
      onReady: () => { readyCalled = true },
    })

    app.trigger('ready')
    expect(readyCalled).toBe(true)
  })

  test('registers single-instance lock on init', () => {
    const app = createMockApp()
    createLifecycle(app as any, {})
    expect(app.requestSingleInstanceLock).toHaveBeenCalled()
  })

  test('calls second-instance handler to restore and focus window', () => {
    const app = createMockApp()
    let secondInstanceCalled = false
    const mockWindow = {
      isMinimized: mock(() => false),
      restore: mock(() => {}),
      focus: mock(() => {}),
    }

    const hooks: LifecycleHooks = {
      getMainWindow: () => mockWindow as any,
      onSecondInstance: () => { secondInstanceCalled = true },
    }

    createLifecycle(app as any, hooks)
    app.trigger('second-instance')
    expect(secondInstanceCalled).toBe(true)
    expect(mockWindow.focus).toHaveBeenCalled()
  })

  test('quits on second-instance when single lock denied', () => {
    const app = createMockApp()
    app.requestSingleInstanceLock = mock(() => false)

    createLifecycle(app as any, {})
    expect(app.quit).toHaveBeenCalled()
  })

  test('quits on window-all-closed when not darwin', () => {
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'linux' })

    const app = createMockApp()
    createLifecycle(app as any, {})
    app.trigger('window-all-closed')
    expect(app.quit).toHaveBeenCalled()

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  test('calls onWillQuit when app fires will-quit event', () => {
    const app = createMockApp()
    let quitCalled = false

    createLifecycle(app as any, {
      onWillQuit: () => { quitCalled = true },
    })

    app.trigger('will-quit')
    expect(quitCalled).toBe(true)
  })
})
