/** @jsxImportSource react */
import { describe, test, expect, mock } from 'bun:test'
import { render, screen } from '@testing-library/react'
import ChatThread from '../src/components/chat/ChatThread'
import { makeMessage } from '../src/lib/chat-reducer'
import { MemoryRouter } from 'react-router-dom'

function defaultProps() {
  return {
    messages: [
      makeMessage('assistant', 'Hello, how can I help?'),
      makeMessage('user', 'Generate an image'),
      makeMessage('assistant', '', 'thinking'),
      makeMessage('assistant', 'Failed: timeout', 'error', { retryFn: () => {} }),
    ],
    streamingMsgId: null,
    isStreaming: false,
    projectData: null,
    urlProjectId: undefined,
    imageCount: 4,
    disabledPlanPrompts: new Set(),
    debugLog: [],
    onStop: mock(() => {}),
    onConfirmPlan: mock(() => {}),
    onCancelPlan: mock(() => {}),
    onTogglePrompt: mock(() => {}),
  }
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

describe('ChatThread', () => {
  test('renders assistant message', () => {
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} /></Wrapper>)
    expect(container.textContent).toContain('Hello, how can I help?')
  })

  test('renders user message', () => {
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} /></Wrapper>)
    expect(container.textContent).toContain('Generate an image')
  })

  test('renders thinking indicator', () => {
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} /></Wrapper>)
    expect(container.textContent).toContain('思考中')
  })

  test('renders error retry button', () => {
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} /></Wrapper>)
    expect(container.textContent).toContain('Failed: timeout')
    expect(container.textContent).toContain('重试')
  })

  test('renders welcome cards when no project', () => {
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} /></Wrapper>)
    expect(container.textContent).toContain('风格画廊')
    expect(container.textContent).toContain('项目历史')
  })

  test('renders speaker labels', () => {
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} /></Wrapper>)
    expect(container.textContent).toContain('你')
    expect(container.textContent).toContain('助手')
  })


  test('renders streaming cursor when streaming', () => {
    const msgs = [makeMessage('assistant', 'text', 'runner')]
    render(<Wrapper><ChatThread {...defaultProps()} messages={msgs} streamingMsgId={msgs[0].id} isStreaming={true} /></Wrapper>)
    expect(document.querySelector('.animate-pulse')).not.toBeNull()
  })

  test('renders debug log for runner messages', () => {
    const msgs = [makeMessage('assistant', '', 'runner')]
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} messages={msgs} debugLog={['log line 1', 'log line 2']} /></Wrapper>)
    expect(container.textContent).toContain('调试日志')
  })

  test('renders empty state with Gallery Guide', () => {
    const { container } = render(<Wrapper><ChatThread {...defaultProps()} messages={[]} /></Wrapper>)
    expect(container.textContent).toContain('风格画廊')
  })
})
