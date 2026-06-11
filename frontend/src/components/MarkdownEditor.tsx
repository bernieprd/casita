import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 4 }: MarkdownEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function apply(fn: (text: string, start: number, end: number) => { text: string; cursor: number | [number, number] }) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const result = fn(value, start, end)
    onChange(result.text)
    requestAnimationFrame(() => {
      el.focus()
      if (Array.isArray(result.cursor)) {
        el.setSelectionRange(result.cursor[0], result.cursor[1])
      } else {
        el.setSelectionRange(result.cursor, result.cursor)
      }
    })
  }

  function handleBold() {
    apply((text, start, end) => {
      if (start === end) {
        const next = text.slice(0, start) + '****' + text.slice(end)
        return { text: next, cursor: start + 2 }
      }
      const selection = text.slice(start, end)
      const next = text.slice(0, start) + `**${selection}**` + text.slice(end)
      return { text: next, cursor: [start + 2, end + 2] }
    })
  }

  function handleHeading(level: 1 | 2) {
    apply((text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      const lineEnd = text.indexOf('\n', start)
      const end = lineEnd === -1 ? text.length : lineEnd
      const line = text.slice(lineStart, end)

      let newLine: string
      if (level === 1 && line.startsWith('# ') && !line.startsWith('## ')) {
        newLine = line.slice(2)
      } else if (level === 1 && line.startsWith('## ')) {
        newLine = line.slice(3)
      } else if (level === 2 && line.startsWith('## ')) {
        newLine = line.slice(3)
      } else if (level === 2 && line.startsWith('# ') && !line.startsWith('## ')) {
        newLine = `## ${line.slice(2)}`
      } else {
        const prefix = level === 1 ? '# ' : '## '
        const stripped = line.replace(/^#{1,3} /, '')
        newLine = prefix + stripped
      }

      const next = text.slice(0, lineStart) + newLine + text.slice(end)
      const delta = newLine.length - line.length
      return { text: next, cursor: start + delta }
    })
  }

  function handleBullet() {
    apply((text, start) => {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      const lineEnd = text.indexOf('\n', start)
      const end = lineEnd === -1 ? text.length : lineEnd
      const line = text.slice(lineStart, end)

      let newLine: string
      if (line.startsWith('- ') || line.startsWith('* ')) {
        newLine = line.slice(2)
      } else {
        newLine = `- ${line}`
      }

      const next = text.slice(0, lineStart) + newLine + text.slice(end)
      const delta = newLine.length - line.length
      return { text: next, cursor: start + delta }
    })
  }

  return (
    <div className="rounded-md border border-input focus-within:ring-1 focus-within:ring-ring overflow-hidden">
      <div className="flex gap-0.5 px-1.5 py-1 border-b border-input bg-muted/40">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs font-bold"
          onClick={handleBold}
          tabIndex={-1}
        >
          B
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => handleHeading(1)}
          tabIndex={-1}
        >
          H1
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => handleHeading(2)}
          tabIndex={-1}
        >
          H2
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={handleBullet}
          tabIndex={-1}
        >
          •
        </Button>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-none border-0 focus-visible:ring-0 outline-none"
      />
    </div>
  )
}
