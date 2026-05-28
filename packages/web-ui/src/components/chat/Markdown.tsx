import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const renderer = new marked.Renderer()
renderer.link = function ({ href, title, text }) {
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 underline">${text}</a>`
}
renderer.image = function ({ href, title, text }) {
  return `<span class="text-zinc-500 text-xs">[Image: ${text || href}]</span>`
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w一-鿿\s-]/g, '')
    .replace(/\s+/g, '-')
}
renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
  const id = slugify(text)
  return `<h${depth} id="${id}">${text}</h${depth}>`
}

marked.use({
  gfm: true,
  breaks: true,
  renderer,
})

export default function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    if (!text) return ''
    const raw = marked.parse(text, { async: false }) as string
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'del', 'img'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'title', 'src', 'alt', 'id'],
    })
  }, [text])

  if (className) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <div
      className="max-w-none break-words text-sm leading-relaxed
        [&_p]:m-0 [&_p+p]:mt-2
        [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0
        [&_pre]:my-2 [&_pre]:bg-zinc-900 [&_pre]:rounded-lg [&_pre]:p-3
        [&_code]:bg-zinc-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
        [&_pre>code]:bg-transparent [&_pre>code]:p-0 [&_pre>code]:text-xs
        [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-700 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-400 [&_blockquote]:my-2
        [&_strong]:text-zinc-100 [&_strong]:font-semibold
        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1
        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1
        [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-0.5
        [&_hr]:my-3 [&_hr]:border-zinc-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
