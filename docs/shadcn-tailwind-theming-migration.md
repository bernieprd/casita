# Dev Plan: Migrate to shadcn/ui + Tailwind v4 with Runtime User Theming

## Context

The app currently uses MUI v7 + Emotion. The goal is to replace it with shadcn/ui (Radix-primitive-based, copy-into-project components) on top of Tailwind CSS v4. By default the app will look minimal/neutral. Users can then customize their household's look — primary color, font family, border radius — through a settings panel. Preferences are persisted in localStorage first and optionally synced to the backend later.

---

## Current Status (as of 2026-06-08)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0a — Remove MUI, install Tailwind + shadcn | ✅ Done | Tailwind + shadcn installed; MUI removed from `package.json` and vite chunks |
| Phase 0b — Base CSS + main.tsx cleanup | ✅ Done | `index.css` done; `main.tsx` clean (ThemeProvider/CssBaseline removed, `applyTheme` + `<Toaster>` present); `theme.ts` deleted |
| Phase 0c — shadcn components | ✅ Done | 20 components in `src/components/ui/` (collapsible added in Phase 2; command added in Phase 3) |
| Phase 1 — Theme customization system | ✅ Done | `lib/theme.ts`, `hooks/useTheme.ts`, `ThemeCustomizer.tsx` all complete |
| ThemePreview route (added, not in original plan) | ✅ Done | `/theme-preview` showcases all shadcn components with live theming |
| Phase 2 — Component migrations (A–F) | ✅ Done | All 15 app files migrated (commit `120f617`) |
| Phase 3 — Integration pass | ✅ Done | Items.tsx migrated; MUI packages removed; vite chunk removed; `App.css` deleted; build passes |

---

## Branch Setup

Branch: `feat/shadcn-theming` ✅

---

## Phase 0 — Foundation (sequential, all other phases depend on this)

### 0a. Remove MUI, install Tailwind + shadcn

```bash
# Remove MUI/Emotion
npm remove @mui/material @mui/icons-material @emotion/react @emotion/styled

# Install Tailwind v4 (Vite plugin approach)
npm install tailwindcss @tailwindcss/vite

# Install Lucide icons (shadcn default icon set)
npm install lucide-react

# Init shadcn (use New York style, CSS variables, neutral base color)
npx shadcn@latest init
```

**Status:**
- ✅ `tailwindcss` v4.3.0, `@tailwindcss/vite` v4.3.0, `lucide-react` v1.17.0 installed
- ✅ `components.json` created (shadcn init ran)
- ✅ `@tailwindcss/vite` plugin added to `vite.config.ts`
- ✅ `@mui/material`, `@emotion/react`, `@emotion/styled` removed from `package.json`
- ✅ MUI manual chunk (`vendor-mui`) removed from `vite.config.ts` rollupOptions

**`frontend/vite.config.ts`** — `@tailwindcss/vite` plugin ✅, `vendor-mui` chunk removed ✅

### 0b. Base CSS variables (the "stripped" default theme)

**`frontend/src/index.css`** ✅ — complete with `@import "tailwindcss"`, `:root` variables, and `@theme inline {}` block:

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --primary: 152 41% 30%;       /* forest green default — user overridable */
    --primary-foreground: 0 0% 98%;
    --secondary: 210 40% 96%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 152 41% 30%;
    --radius: 0.5rem;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
}

@theme inline {
  --color-background:             hsl(var(--background));
  --color-foreground:             hsl(var(--foreground));
  /* ... all 19 color mappings + --radius + --font-sans */
}
```

**`frontend/src/main.tsx`** ✅ — `applyTheme(loadTheme())` called before `createRoot`; `ThemeProvider` and `CssBaseline` removed; `<Toaster>` mounted.

**`frontend/src/theme.ts`** ✅ — deleted.

### 0c. Add all shadcn components needed

```bash
npx shadcn@latest add button input dialog drawer tabs select checkbox \
  radio-group switch badge skeleton alert separator avatar label textarea \
  form sonner progress collapsible sheet scroll-area slider popover command
```

**Status:** ✅ 20 components installed in `src/components/ui/`:
avatar, badge, button, card, checkbox, collapsible, command, dialog, drawer, input, label, radio-group, select, separator, sheet, skeleton, slider, switch, tabs, textarea

Note: `collapsible` was added during Phase 2 (Workstream C). `command` was added during Phase 3 (required by `RecipeFormPage.tsx` for the ingredient autocomplete). The remaining originally-listed components (`alert`, `form`, `sonner`, `progress`, `scroll-area`, `popover`) were not needed — Phase 2 migrations used `sonner` via the `sonner` package directly and the other components were not required by the migrated files.

---

## Phase 1 — Theme Customization System ✅ Complete

### Files created

**`frontend/src/lib/theme.ts`** ✅  
`ThemePrefs` interface, `DEFAULT_THEME`, `applyTheme()`, `loadTheme()`, `saveTheme()` — all implemented.

**`frontend/src/hooks/useTheme.ts`** ✅  
Loads prefs on mount via `useState(loadTheme)`, exposes `{ prefs, setPrefs }`. `setPrefs` calls `applyTheme + saveTheme`.

**`frontend/src/components/ThemeCustomizer.tsx`** ✅  
Sheet-based panel with:
- Color preset swatches → updates `--primary` and `--ring`
- Font family selector (system fonts + Google Fonts with dynamic loading) → updates `--font-sans`
- Border radius slider (0 → 16 steps) → updates `--radius`

**`frontend/src/components/ThemePreview.tsx`** ✅ *(added — not in original plan)*  
Route `/theme-preview` — full component showcase (typography, buttons, form controls, cards, overlays, badges, skeleton, toasts, tabs) with live ThemeCustomizer integration. Useful for verifying theme changes before migrating real pages.

### Integration

- ✅ `main.tsx` calls `applyTheme(loadTheme())` before `createRoot` (no flash of unstyled content)
- ✅ `Settings.tsx` — Appearance section with `<ThemeCustomizer />` added (completed in Workstream F)

---

## Phase 2 — Component Migrations (6 parallel agent workstreams) ✅ Complete (commit `120f617`)

All workstreams completed on `feat/shadcn-theming`. All 15 app component files migrated.

### Icon mapping (Lucide replacements for `@mui/icons-material`)

| MUI Icon | Lucide |
|---|---|
| RefreshIcon | `RotateCcw` |
| SettingsIcon | `Settings` |
| WifiOffIcon | `WifiOff` |
| ArrowBackIcon | `ArrowLeft` |
| HomeIcon | `Home` |
| CalendarMonthIcon | `CalendarDays` |
| CheckBoxIcon | `CheckSquare` |
| ShoppingCartIcon | `ShoppingCart` |
| MenuBookIcon | `BookOpen` |
| ChevronLeftIcon | `ChevronLeft` |
| ChevronRightIcon | `ChevronRight` |
| ExpandLess | `ChevronUp` |
| ExpandMore | `ChevronDown` |
| SearchIcon | `Search` |
| ClearIcon | `X` |
| AddCircleOutlineIcon | `PlusCircle` |
| EditIcon | `Pencil` |
| ContentCopyIcon | `Copy` |
| DeleteOutlineIcon | `Trash2` |
| AddIcon | `Plus` |
| CloseIcon | `X` |
| DragIndicatorIcon | `GripVertical` |
| CheckIcon | `Check` |
| AddPhotoAlternateIcon | `ImagePlus` |
| IosShareIcon | `Share` |
| MergeTypeIcon | `GitMerge` |

### Key pattern mappings

| MUI | shadcn/Tailwind equivalent |
|---|---|
| `Box` with `sx` | `<div className="...">` with Tailwind utilities |
| `Typography variant="h6"` | `<h2 className="text-lg font-semibold">` |
| `Chip` | `<Badge>` |
| `Divider` | `<Separator>` |
| `Snackbar` + `Alert` | `toast()` from Sonner |
| `Skeleton` | `<Skeleton>` |
| `CircularProgress` | `<div className="animate-spin ...">` or `<Progress>` |
| `Fab` | `<Button size="icon" className="rounded-full fixed bottom-20 right-4">` |
| `Drawer` (bottom sheet) | `<Drawer>` (vaul-based, already in shadcn) |
| `Drawer` (side) | `<Sheet>` |
| `Dialog` | `<Dialog>` |
| `useTheme + useMediaQuery` | custom `useIsMobile()` hook (check `window.innerWidth < 768`) |
| `Tabs + Tab` | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` |
| `Autocomplete` | `<Command>` with `<CommandInput>` + `<CommandItem>` |
| `Select + MenuItem` | `<Select>` + `<SelectItem>` |
| `AppBar + Toolbar` | `<header className="sticky top-0 z-50 ...">` |
| `BottomNavigation` | `<nav className="fixed bottom-0 w-full ...">` |
| `ListItemButton + Collapse` | `<Collapsible>` + `<CollapsibleContent>` |
| `Switch` | `<Switch>` |
| `FormControlLabel + Radio` | `<RadioGroup>` + `<RadioGroupItem>` |
| `TextField` | `<Input>` or `<Textarea>` |
| `Stack spacing={x}` | `<div className="flex gap-x">` |

### Custom hooks to preserve

- `useKeyboardOffset()` — in `src/hooks/useKeyboardOffset.ts`, handles iOS keyboard inset. Keep as-is, just remove MUI types.
- Replace `useMediaQuery(theme.breakpoints.down('sm'))` with a simple `useIsMobile()` hook:
  ```ts
  const useIsMobile = () => window.innerWidth < 768
  ```

### Page-level max-width pattern

Replace `Box sx={{ maxWidth: 600, mx: 'auto' }}` with `<div className="max-w-xl mx-auto px-4">`.

---

### Workstream A — App shell + navigation (`App.tsx`, `Home.tsx`, `HouseholdSetup.tsx`)

**`App.tsx`** — heaviest file. Replace:
- `AppBar + Toolbar` → sticky header div
- `BottomNavigation + BottomNavigationAction` → fixed bottom nav with Lucide icons
- `Box`, `Typography`, `Alert`, `CircularProgress`, `LinearProgress` → Tailwind divs + shadcn components
- All `sx` → Tailwind classes

**After migrating `App.tsx`:** ✅ Done — `ThemeProvider`, `CssBaseline`, and the `theme` import removed from `main.tsx`; `src/theme.ts` deleted.

**`Home.tsx`** — replace `Box`, `Typography`, `Skeleton`, `Chip`, `IconButton` with Tailwind + shadcn `Skeleton`, `Badge`

**`HouseholdSetup.tsx`** — replace `Box`, `Stack`, `TextField`, `Button`, `Alert`, `Tabs` with shadcn equivalents

---

### Workstream B — Shopping (`Shopping.tsx`, `ShoppingList.tsx`)

**`Shopping.tsx`** — replace `Tabs`, `TextField` with `InputAdornment`-equivalent (Lucide `Search` icon inside input), `Button`, `List`, `Paper`

**`ShoppingList.tsx`** — most complex: responsive `Drawer` vs `Dialog` based on screen size → use `useIsMobile()`, shadcn `Drawer` (vaul) for mobile, `Dialog` for desktop. Replace `Checkbox`, `Collapse` with `Collapsible`.

---

### Workstream C — Todos + Calendar (`Todos.tsx`, `Calendar.tsx`)

**`Todos.tsx`** — replace `Drawer`, `Collapse`, `List`, `TextField`, `Button`, `Chip`, `Snackbar/Alert` → vaul `Drawer`, `Collapsible`, shadcn `Input`, `Badge`, `toast()`

**`Calendar.tsx`** — lightweight: replace `Box`, `Typography`, `IconButton`, `Skeleton` with Tailwind + Lucide chevrons

---

### Workstream D — Recipes (`Recipes.tsx`, `PublicRecipeView.tsx`)

**`Recipes.tsx`** — replace `Fab`, `TextField`, `Snackbar`, `List`, `Chip`, grid layout; keep lazy image loading pattern intact

**`PublicRecipeView.tsx`** — simple read-only view, replace `Box`, `Typography`, `Chip`, `Skeleton`, `Stack`

---

### Workstream E — Forms (`RecipeFormPage.tsx`, `ItemFormDialog.tsx`)

**`RecipeFormPage.tsx`** — most complex form: replace `AppBar`, `TextField`, `Autocomplete` (→ `Command`), drag handles (`GripVertical` Lucide icon), `Dialog`, `CircularProgress`, photo upload preview

**`ItemFormDialog.tsx`** — responsive `Drawer`/`Dialog` with `useKeyboardOffset`; replace `TextField`, `Autocomplete`, `Button`

---

### Workstream F — Sheets + Settings (`Settings.tsx`, `MergeDuplicatesSheet.tsx`, `IncompleteItemsSheet.tsx`, `TabErrorBoundary.tsx`)

**`Settings.tsx`** — add Appearance section with `<ThemeCustomizer />` (from Phase 1); replace existing `Switch`, `Select`, `TextField`, `Avatar`, `Chip`, `Divider`

**`MergeDuplicatesSheet.tsx`** — replace `Drawer`, `RadioGroup`, `FormControlLabel`, `Button`

**`IncompleteItemsSheet.tsx`** — replace `Drawer`, `List`, `Button`

**`TabErrorBoundary.tsx`** — minimal: replace `Box`, `Typography`, `Button`

---

## Phase 3 — Integration Pass (sequential, after all Phase 2 workstreams done)

1. Delete `src/theme.ts` (if not already deleted in Workstream A)
2. Delete `src/App.css` (now replaced by `index.css`)
3. Remove MUI packages: `npm remove @mui/material @mui/icons-material @emotion/react @emotion/styled`
4. Remove `vendor-mui` manual chunk from `vite.config.ts` rollupOptions
5. Verify no remaining `@mui` imports: `grep -r "@mui" src/`
6. Verify no remaining `sx` prop usage: `grep -r " sx=" src/`
7. Ensure `sonner` `<Toaster>` is mounted in `main.tsx` or `App.tsx`
8. Run `npm run build` — resolve any TypeScript errors

---

## Critical Files

| File | Action | Status |
|------|--------|--------|
| `frontend/src/theme.ts` | Delete | ✅ Deleted |
| `frontend/src/App.css` | Replace with `index.css` | ✅ Deleted |
| `frontend/src/main.tsx` | Remove ThemeProvider/CssBaseline, add theme init call + Toaster | ✅ Done |
| `frontend/vite.config.ts` | Add Tailwind vite plugin, remove MUI chunks | ✅ Done |
| `frontend/package.json` | Remove MUI/Emotion, add Tailwind + Lucide | ✅ Done |
| `frontend/src/lib/theme.ts` | Create — theme prefs model + CSS var helpers | ✅ Done |
| `frontend/src/hooks/useTheme.ts` | Create — React hook for theme prefs | ✅ Done |
| `frontend/src/components/ThemeCustomizer.tsx` | Create — user-facing theme panel | ✅ Done |
| `frontend/src/components/ThemePreview.tsx` | Create — component showcase at `/theme-preview` | ✅ Done (added to plan) |
| `frontend/src/components/ui/` | Generated by shadcn CLI | ✅ Done (20 components, including command) |
| All `src/components/*.tsx` | Migrate MUI → shadcn + Tailwind | ✅ Done (Items.tsx migrated in Phase 3) |

---

## Verification

1. `npm run dev` — app starts, default look is minimal/neutral (no Material chrome)
2. Navigate to `/theme-preview` — all shadcn components render correctly with the active theme
3. Navigate all pages — no visual regressions, components render
4. Open Settings → Appearance panel:
   - Change primary color → buttons, chips, highlights update live
   - Change font family → typography updates site-wide
   - Drag radius slider → all rounded corners update
5. Reload page → theme preferences are restored from localStorage
6. Test on mobile (375px) — bottom nav, bottom sheets, responsive forms all work
7. `npm run build` — no TypeScript errors, bundle succeeds
8. `grep -r "@mui" src/` returns nothing
