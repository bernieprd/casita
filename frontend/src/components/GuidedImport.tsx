import { useState } from 'react'
import { Check, Copy, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useImport } from '../api/import'
import type { ImportBody } from '../api/import'

// ── Format guide ──────────────────────────────────────────────────────────────

const FORMAT_GUIDE = `Convert your data to this JSON format. Omit any key whose array is empty.

{
  "items": [
    { "name": "string", "category": "string or null", "onShoppingList": true or false }
  ],
  "recipes": [
    {
      "name": "string",
      "type": "string or null (e.g. Breakfast, Lunch, Dinner, Snack)",
      "url": "string or null",
      "instructions": "use markdown: # for headings, - for bullet points, --- for dividers between sections",
      "ingredients": [
        { "name": "string", "quantity": "string or null (e.g. '2 cups', '1 tbsp')" }
      ]
    }
  ],
  "todos": [
    {
      "name": "string",
      "priority": "High, Medium, Low, or null",
      "due": "YYYY-MM-DD or null"
    }
  ]
}

Rules:
- Every entry must have a non-empty "name".
- Set onShoppingList to true only if the item needs to be bought right now.
- For recipes, preserve headings and steps using markdown format.
- Do not invent data — only include data from your source.`

// ── Types ─────────────────────────────────────────────────────────────────────

interface GuidedImportProps {
  onDone: () => void
  onSkip: () => void
}

type Step = 'prompt' | 'preview' | 'importing'

// ── Component ─────────────────────────────────────────────────────────────────

export default function GuidedImport({ onDone, onSkip }: GuidedImportProps) {
  const [step, setStep] = useState<Step>('prompt')
  const [jsonText, setJsonText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ImportBody | null>(null)
  const [copied, setCopied] = useState(false)

  const importMutation = useImport()

  function handleJsonChange(value: string) {
    setJsonText(value)
    if (!value.trim()) {
      setParseError(null)
      setParsed(null)
      return
    }
    try {
      const result = JSON.parse(value) as ImportBody
      const hasInvalidEntry = (arr: unknown[] | undefined) =>
        (arr ?? []).some(
          e =>
            typeof (e as Record<string, unknown>).name !== 'string' ||
            !(e as { name: string }).name.trim(),
        )
      if (
        hasInvalidEntry(result.items) ||
        hasInvalidEntry(result.todos) ||
        hasInvalidEntry(result.recipes)
      ) {
        setParseError('Each entry must have a non-empty "name" field.')
        setParsed(null)
        return
      }
      setParsed(result)
      setParseError(null)
    } catch (e) {
      setParseError((e as Error).message)
      setParsed(null)
    }
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(FORMAT_GUIDE).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function hasData(p: ImportBody | null): boolean {
    if (!p) return false
    return (
      (p.items?.length ?? 0) > 0 ||
      (p.recipes?.length ?? 0) > 0 ||
      (p.todos?.length ?? 0) > 0
    )
  }

  function handleImport() {
    if (!parsed) return
    setStep('importing')
    importMutation.mutate(parsed, {
      onSuccess: (result) => {
        const { items, recipes, todos } = result.imported
        const parts: string[] = []
        if (items > 0) parts.push(`${items} item${items !== 1 ? 's' : ''}`)
        if (recipes > 0) parts.push(`${recipes} recipe${recipes !== 1 ? 's' : ''}`)
        if (todos > 0) parts.push(`${todos} to-do${todos !== 1 ? 's' : ''}`)
        let message = `Imported ${parts.join(', ')}`
        if ((result.skipped?.items ?? 0) > 0) {
          message += ` (${result.skipped!.items} item${result.skipped!.items !== 1 ? 's' : ''} already existed)`
        }
        toast.success(message)
        onDone()
      },
      onError: () => {
        toast.error('Import failed. Please try again.')
        setStep('preview')
      },
    })
  }

  // ── Step: importing ──────────────────────────────────────────────────────────

  if (step === 'importing' || importMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Importing your data…</p>
      </div>
    )
  }

  // ── Step: preview ────────────────────────────────────────────────────────────

  if (step === 'preview' && parsed) {
    const itemCount = parsed.items?.length ?? 0
    const recipeCount = parsed.recipes?.length ?? 0
    const todoCount = parsed.todos?.length ?? 0

    const categories: Array<{ label: string; count: number; names: string[] }> = []
    if (itemCount > 0)
      categories.push({ label: 'items', count: itemCount, names: (parsed.items ?? []).map(i => i.name) })
    if (recipeCount > 0)
      categories.push({ label: 'recipes', count: recipeCount, names: (parsed.recipes ?? []).map(r => r.name) })
    if (todoCount > 0)
      categories.push({ label: 'to-dos', count: todoCount, names: (parsed.todos ?? []).map(t => t.name) })

    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold">Ready to import</h2>
        </div>

        <div className="bg-muted rounded-lg p-4 flex flex-col gap-2">
          {categories.map(({ label, count }) => (
            <div key={label} className="flex items-center gap-2">
              <Check className="size-4 text-primary shrink-0" />
              <span className="text-sm">
                <span className="font-bold">{count}</span> {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {categories.map(({ label, count, names }) => {
            const visible = names.slice(0, 5)
            const remaining = count - visible.length
            return (
              <div key={label} className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                {visible.map((name, i) => (
                  <p key={i} className="text-sm text-muted-foreground pl-2">{name}</p>
                ))}
                {remaining > 0 && (
                  <p className="text-xs text-muted-foreground/60 pl-2">+ {remaining} more</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={handleImport}>
            Import
          </Button>
          <button
            type="button"
            onClick={() => setStep('prompt')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // ── Step: prompt ─────────────────────────────────────────────────────────────

  const canPreview = parseError === null && jsonText.trim() !== '' && hasData(parsed)

  return (
    <div className="flex flex-col gap-5 overflow-y-auto max-h-[70dvh] pr-1">
      <div>
        <h2 className="text-base font-semibold">Import your existing data</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Use this format guide to convert your grocery list, recipes, or to-dos into the JSON
          format Casita needs.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">1. Copy the format guide</p>
        <pre className="overflow-auto max-h-48 text-xs font-mono bg-muted rounded-lg p-3 whitespace-pre-wrap">
          {FORMAT_GUIDE}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={handleCopyPrompt}
        >
          {copied ? (
            <>
              <CheckCheck className="size-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy format guide
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">2. Paste the formatted JSON</p>
        <Textarea
          rows={6}
          placeholder='{ "items": [...], "recipes": [...], "todos": [...] }'
          value={jsonText}
          onChange={e => handleJsonChange(e.target.value)}
          className="font-mono text-xs resize-none max-h-48 overflow-y-auto"
        />
        {parseError && (
          <p className="text-xs text-destructive">{parseError}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={!canPreview}
          onClick={() => setStep('preview')}
        >
          Preview import →
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
