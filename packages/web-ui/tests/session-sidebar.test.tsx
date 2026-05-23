/** @jsxImportSource react */
import { describe, test, expect, mock } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import SessionSidebar from '../src/components/chat/SessionSidebar'

function defaultProps() {
  return {
    sessions: [
      { id: 's1', title: 'Chat 1', status: 'reviewing', lastMessage: 'Hello', imageCount: 3, artifactCount: 5, createdAt: '2025-01-01', updatedAt: '2025-01-02' },
      { id: 's2', title: 'Chat 2', status: 'generating', lastMessage: 'Generate image', imageCount: 0, artifactCount: 1, createdAt: '2025-01-01', updatedAt: new Date().toISOString() },
    ],
    activeId: null,
    loading: false,
    onCreate: mock(() => {}),
    onSwitch: mock(() => {}),
    onRename: mock(() => {}),
    onDelete: mock(() => {}),
    onClose: mock(() => {}),
  }
}

describe('SessionSidebar', () => {
  test('renders session titles', () => {
    const { container } = render(<SessionSidebar {...defaultProps()} />)
    expect(container.textContent).toContain('Chat 1')
    expect(container.textContent).toContain('Chat 2')
  })

  test('renders empty state when no sessions', () => {
    const { container } = render(<SessionSidebar {...defaultProps()} sessions={[]} />)
    expect(container.textContent).toContain('No sessions yet')
  })

  test('renders image count and status', () => {
    const { container } = render(<SessionSidebar {...defaultProps()} />)
    expect(container.textContent).toContain('3 images')
    expect(container.textContent).toContain('Generating...')
  })

  test('highlights active session', () => {
    const { container } = render(<SessionSidebar {...defaultProps()} activeId="s1" />)
    const items = container.querySelectorAll('[role="button"]')
    const activeItem = Array.from(items).find(b => b.textContent?.includes('Chat 1'))
    expect(activeItem?.className).toContain('border-l-indigo-500')
  })

  test('calls onSwitch on click', () => {
    const onSwitch = mock(() => {})
    const { container } = render(<SessionSidebar {...defaultProps()} onSwitch={onSwitch} />)
    const items = container.querySelectorAll('[role="button"]')
    const chatItem = Array.from(items).find(b => b.textContent?.includes('Chat 1'))
    fireEvent.click(chatItem!)
    expect(onSwitch).toHaveBeenCalledWith('s1')
  })

  test('new session button exists', () => {
    render(<SessionSidebar {...defaultProps()} />)
    const btn = document.querySelector('[title="New session"]')
    expect(btn).not.toBeNull()
  })

  test('delete button exists for each session', () => {
    const { container } = render(<SessionSidebar {...defaultProps()} />)
    const btns = container.querySelectorAll('[title="Delete"]')
    expect(btns.length).toBe(2)
  })

  test('shows last message preview', () => {
    const { container } = render(<SessionSidebar {...defaultProps()} />)
    expect(container.textContent).toContain('Hello')
  })
})
