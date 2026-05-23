/** @jsxImportSource react */
import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import Markdown from '../src/components/chat/Markdown'

describe('Markdown', () => {
  test('renders plain text', () => {
    const { container } = render(<Markdown text="hello world" />)
    expect(container.textContent).toContain('hello world')
  })

  test('renders bold text', () => {
    const { container } = render(<Markdown text="**bold**" />)
    expect(container.querySelector('strong')).not.toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  test('renders links with target blank', () => {
    const { container } = render(<Markdown text="[link](https://example.com)" />)
    const a = container.querySelector('a')
    expect(a).not.toBeNull()
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.getAttribute('target')).toBe('_blank')
    expect(a?.getAttribute('rel')).toContain('noopener')
  })

  test('renders code blocks', () => {
    const { container } = render(<Markdown text="```\nconst x = 1;\n```" />)
    expect(container.querySelector('code')).not.toBeNull()
  })

  test('renders inline code', () => {
    const { container } = render(<Markdown text="use `parseSSEStream()`" />)
    expect(container.querySelector('code')).not.toBeNull()
    expect(container.querySelector('code')?.textContent).toContain('parseSSEStream')
  })

  test('renders unordered lists', () => {
    const { container } = render(<Markdown text="- item 1\n- item 2\n" />)
    expect(container.querySelector('ul')).not.toBeNull()
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0)
  })

  test('renders blockquotes', () => {
    const { container } = render(<Markdown text="> quoted text" />)
    expect(container.querySelector('blockquote')).not.toBeNull()
  })

  test('sanitizes script tags', () => {
    const { container } = render(<Markdown text="<script>alert('xss')</script>hello" />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('hello')
  })

  test('sanitizes onclick handlers', () => {
    const { container } = render(<Markdown text="<div onclick='alert(1)'>click</div>" />)
    const div = container.querySelector('div')
    expect(div?.getAttribute('onclick')).toBeNull()
  })

  test('renders empty string', () => {
    const { container } = render(<Markdown text="" />)
    expect(container.querySelector('div')?.innerHTML).toBe('')
  })

  test('renders line breaks', () => {
    const { container } = render(<Markdown text="line1\nline2" />)
    expect(container.textContent).toContain('line1')
    expect(container.textContent).toContain('line2')
  })
})
