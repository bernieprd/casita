Critical: React hooks called conditionally ￼

In Items.tsx (lines 194–195) and Recipes.tsx (lines 223–224), ‎`useState` is called inside an early-return ‎`if` block:

```tsx
if (allItems.length === 0) {
  const [importOpen, setImportOpen] = useState(false)   // ← violation
  const isMobileImport = window.innerWidth < 768
  return ( ... )
}

```

This violates React’s rules of hooks (https://react.dev/reference/rules/rules-of-hooks). Hooks must always be called in the same order at the top level of the component. When ‎`allItems` goes from empty to non-empty (e.g. after a successful import), React will see a different number of hooks between renders and throw a runtime error. Move ‎`useState` to the top of each component, alongside the existing state declarations.

Todos.tsx does this correctly — the state is declared at the component top level (lines 487–488).

High: Duplicated Drawer/Dialog import modal (~30 lines x 3) ￼

The responsive Drawer (mobile) / Dialog (desktop) wrapper for ‎`<GuidedImport>` is copy-pasted verbatim across Items.tsx, Recipes.tsx, and Todos.tsx. Extract it into a small shared component, e.g.:

```tsx
function ImportModal({ open, onOpenChange, children }) {
  const isMobile = window.innerWidth < 768
  // ...Drawer or Dialog wrapper
}

```

This also consolidates the ‎`isMobileImport` logic and the ‎`DrawerDescription` / ‎`DialogDescription` accessibility strings.

Medium: ‎`isMobileImport` doesn’t react to viewport changes ￼

‎`const isMobileImport = window.innerWidth < 768` is evaluated once at render time. If a user rotates their phone or resizes their browser, the wrong surface (Drawer vs Dialog) will stay mounted. A simple fix is a small ‎`useMediaQuery` hook or at minimum ‎`useSyncExternalStore` listening to ‎`matchMedia('(max-width: 767px)')`.

Medium: Content-Length body size guard is easily bypassed ￼

In ‎`import-d1.ts` (lines 27–30), the guard only checks the ‎`Content-Length` header:

```ts
const contentLength = req.headers.get('Content-Length')
if (contentLength && parseInt(contentLength, 10) > 100_000) { ... }

```

This header can be omitted entirely, or it can lie. A request with no ‎`Content-Length` (e.g. chunked transfer encoding) skips the check. Consider reading the body first and checking the actual size, or using a streaming size limit.

Medium: No runtime validation of pasted JSON ￼

In ‎`GuidedImport.tsx` line 78, the parsed JSON is cast with ‎`as ImportBody` — that’s a compile-time assertion, not runtime validation. A user could paste ‎`{"items": [{"oops": true}]}` and the preview would show 1 item with an ‎`undefined` name. The server skips entries with empty names, but the preview step would be misleading. Consider basic shape-checking (e.g. verify ‎`name` is a non-empty string on each entry) before advancing to preview.

Low: N+1 queries in recipe ingredient import ￼

In ‎`import-d1.ts` (lines 185–187), each ingredient triggers an individual ‎`SELECT` to check whether the item already exists:

```ts
const existing = await env.DB.prepare(
  'SELECT id FROM items WHERE household_id = ? AND LOWER(name) = LOWER(?)'
).bind(householdId, ingredientName).first()

```

For a recipe with 20 ingredients across 10 recipes, that’s up to 200 sequential queries. Consider fetching all existing items once (you already do this for the items import section) and reusing that set, or at least building a local lookup map that accumulates newly inserted items.

Low: Missing Drawer/Dialog imports in Items.tsx? ￼

The diff for Recipes.tsx explicitly adds ‎`Drawer` and ‎`Dialog` imports, but the Items.tsx diff only adds ‎`GuidedImport`. If Items.tsx doesn’t already import the Drawer and Dialog components from a prior feature, this will fail at build time. Worth double-checking that ‎`pnpm typecheck` actually passes with these changes.

Nits ￼

- ‎`handleCopyPrompt` (‎`GuidedImport.tsx` line 88) calls ‎`navigator.clipboard.writeText()` without a ‎`.catch()`. This can throw in non-secure contexts or when clipboard permission is denied. A try/catch with a toast fallback would be safer.

- The ‎`onOpenChange` handlers use ‎`v => { if (!v) setImportOpen(false) }` — the ‎`if (!v)` guard is unnecessary since setting ‎`importOpen` to ‎`false` when it’s already ‎`false` is a no-op. Simplify to ‎`onOpenChange={setImportOpen}`.