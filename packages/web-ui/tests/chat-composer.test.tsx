/** @jsxImportSource react */
import { describe, test, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatComposer from '../src/components/chat/ChatComposer'

function defaultProps() {
  return {
    chatInput: '',
    onInputChange: mock(() => {}),
    onSend: mock(() => {}),
    canSubmit: false,
    projectData: null,
    selectedImage: null,
    onClearTarget: mock(() => {}),
    isSidebarOpen: false,
    onToggleSidebar: mock(() => {}),
    configSummary: 'Test Skill · 中文 · 1:1',
    sourceMode: 'text',
    onSourceModeChange: mock(() => {}),
    sourceRef: '',
    onSourceRefChange: mock(() => {}),
    uploadedSourceName: '',
    uploadStatus: '',
    onSourceUpload: mock(() => {}),
    isStreaming: false,
    isPlanning: false,
    onStop: mock(() => {}),
  }
}

describe('ChatComposer', () => {
  test('renders textarea and send button', () => {
    render(<ChatComposer {...defaultProps()} />)
    expect(screen.getByRole('textbox', { name: /chat message input/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /发送/i })).not.toBeNull()
  })

  test('renders config summary', () => {
    render(<ChatComposer {...defaultProps()} />)
    expect(screen.getByText('Test Skill · 中文 · 1:1')).not.toBeNull()
  })

  test('send button disabled when cannot submit', () => {
    render(<ChatComposer {...defaultProps()} canSubmit={false} />)
    expect(screen.getByRole('button', { name: /发送/i }).hasAttribute('disabled')).toBe(true)
  })

  test('send button enabled when can submit', () => {
    render(<ChatComposer {...defaultProps()} canSubmit={true} chatInput="hello" />)
    expect(screen.getByRole('button', { name: /发送/i }).hasAttribute('disabled')).toBe(false)
  })

  test('calls onSend on Enter key', () => {
    const onSend = mock(() => {})
    render(<ChatComposer {...defaultProps()} onSend={onSend} canSubmit={true} chatInput="hello" />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalled()
  })

  test('does not call onSend on Shift+Enter', () => {
    const onSend = mock(() => {})
    render(<ChatComposer {...defaultProps()} onSend={onSend} canSubmit={true} chatInput="hello" />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  test('shows image target indicator', () => {
    render(<ChatComposer {...defaultProps()} selectedImage={2} />)
    expect(screen.getByText(/针对图片 #3 进行修改/)).not.toBeNull()
  })

  test('calls onToggleSidebar on config button click', () => {
    const onToggle = mock(() => {})
    render(<ChatComposer {...defaultProps()} onToggleSidebar={onToggle} />)
    fireEvent.click(screen.getByTitle(/调整生成参数/))
    expect(onToggle).toHaveBeenCalled()
  })

  test('uses project edit placeholder when project is active', () => {
    render(<ChatComposer {...defaultProps()} projectData={{ name: 'test' }} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.placeholder).toContain('要求后续变更…')
  })

  test('uses image edit placeholder when image selected and project active', () => {
    render(<ChatComposer {...defaultProps()} projectData={{ name: 'test' }} selectedImage={0} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.placeholder).toContain('描述对图片 #1 的修改要求…')
  })

  test('renders stop button when streaming', () => {
    const onStop = mock(() => {})
    render(<ChatComposer {...defaultProps()} isStreaming={true} onStop={onStop} />)
    const stopBtn = screen.getByRole('button', { name: /停止生成/i })
    expect(stopBtn).not.toBeNull()
    fireEvent.click(stopBtn)
    expect(onStop).toHaveBeenCalled()
  })
})
