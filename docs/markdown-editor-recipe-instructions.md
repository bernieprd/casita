# Plan: Markdown Editor for Recipe Instructions

## Context
Recipe instructions are currently a plain `<Textarea>`. The backend stores each line as a Notion `paragraph` block. The UI (`RenderBlock`) already knows how to render `heading_1/2/3`, `bulleted_list_item`, and `divider` blocks — but the form never produces them. This change adds a simple markdown toolbar + textarea so users can write formatted instructions naturally. No external markdown library needed; the subset we support is small enough to handle inline.

## Supported Markdown Subset
| Syntax | Block type |
|---|---|
| `# text` | heading_1 |
| `## text` | heading_2 |
| `- text` / `* text` | bulleted_list_item |
| `---` | divider |
| `**text**` | inline bold (display only) |
| plain text | paragraph |

---

## Changes

### 1. New component — `frontend/src/components/MarkdownEditor.tsx`

A wrapper around shadcn `<Textarea>` with a toolbar above it.

**Toolbar buttons:** `B` (bold), `H1`, `H2`, `•` (bullet) — each inserts/wraps the appropriate markdown at cursor position.

Toolbar button logic (all via `selectionStart`/`selectionEnd` + `setRangeText`):
- **Bold**: wraps selection in `**…**`, or inserts `****` with cursor inside if no selection
- **H1 / H2**: toggles prefix on the current line (`# ` / `## `); cycles H1→H2→off
- **Bullet**: toggles `- ` prefix on the current line

Props: `value`, `onChange`, `placeholder`, `rows` — drop-in for `<Textarea>`.

Styling: a `div` with border/rounded wrapping toolbar + textarea (textarea has no top border radius to blend).

### 2. `frontend/src/components/RecipeFormPage.tsx`

Two changes:

**a) Replace Textarea with MarkdownEditor** (line 735):
```tsx
- <Textarea value={instructions} onChange={...} placeholder="One paragraph per line…" rows={4} />
+ <MarkdownEditor value={instructions} onChange={...} placeholder="One paragraph per line…" rows={6} />
```

**b) Update edit-path blocks→markdown conversion** (lines 376-380):
```ts
setInstructions(
  (recipe.blocks ?? [])
    .map(b => {
      switch (b.type) {
        case 'divider':           return '---'
        case 'heading_1':         return `# ${b.text}`
        case 'heading_2':         return `## ${b.text}`
        case 'heading_3':         return `### ${b.text}`
        case 'bulleted_list_item': return `- ${b.text}`
        default:                  return b.text
      }
    })
    .join('\n'),
)
```

### 3. `worker/src/routes/recipes.ts`

Extract a `textToNotionBlock(line: string)` helper and use it in both `createRecipe` and `updateRecipe` (lines 40-44 and 110-114) in place of the hardcoded paragraph mapping:

```ts
function textToNotionBlock(text: string) {
  if (text === '---')         return { type: 'divider', divider: {} }
  if (text.startsWith('# '))  return { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: text.slice(2) } }] } }
  if (text.startsWith('## ')) return { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: text.slice(3) } }] } }
  if (text.startsWith('### '))return { type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: text.slice(4) } }] } }
  if (text.startsWith('- ') || text.startsWith('* '))
                              return { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: text.slice(2) } }] } }
  return { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } }
}
```

### 4. `frontend/src/components/Recipes.tsx`

Add a tiny `renderInline(text: string): ReactNode` helper that splits on `**…**` and renders bold spans:

```tsx
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}
```

Use it inside `RenderBlock` for `paragraph` and `bulleted_list_item` cases (replace `{block.text}` with `{renderInline(block.text)}`).

---

## Files to modify
- `frontend/src/components/MarkdownEditor.tsx` ← new file
- `frontend/src/components/RecipeFormPage.tsx` ← toolbar swap + edit-path fix
- `frontend/src/components/Recipes.tsx` ← inline bold rendering
- `worker/src/routes/recipes.ts` ← parse markdown prefixes into typed blocks

## Verification
1. Open a new recipe form — instructions field should show toolbar with B, H1, H2, • buttons
2. Type `# Step 1` and save — recipe detail view should render it as a large heading
3. Type `- Mix flour` and save — should render as bulleted item
4. Edit the recipe — instructions should rehydrate with `# ` / `- ` prefixes intact
5. Type `**bold text**` in a paragraph — should render bold in detail view
6. Existing plain-text recipes continue to render normally (no regression)
