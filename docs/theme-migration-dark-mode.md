# Theme Migration Plan — Dark Mode (Theme A)

## Design tokens

The target theme (Theme A — "Deep Dark") uses these design tokens:

| Token | Value | Notes |
|---|---|---|
| bg | `#0c0e12` | Page background |
| surface | `#151820` | Cards, AppBar, BottomNav |
| surface-alt | `#1d2130` | Subtle inset areas, image placeholders |
| border | `#252b3b` | All dividers, card borders |
| ink | `#dde2f0` | Primary text |
| ink-muted | `#7c87a6` | Secondary/helper text |
| ink-faint | `#404a62` | Disabled, skeleton |
| primary / accent | `#7c6af7` | Actions, active states, FABs |
| accent-soft | `#2a2454` | Chip bg for active/selected states |
| danger | `#f16b6b` | Errors, destructive actions |
| warning-bg | `#2a2000` | Warning chip/badge bg |
| warning-fg | `#f0c060` | Warning text |
| radius-card | `14px` | All card/paper border radius |
| radius-control | `10px` | Inputs, buttons |
| shadow-card | `0 0 0 1px #252b3b, 0 4px 20px rgba(0,0,0,0.4)` | Card elevation |

---

## Files to change

### 1. `frontend/src/theme.ts`

Replace the entire theme object. Enable MUI dark mode, update all palette values, and tighten the shape/component overrides.

```ts
import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#7c6af7', contrastText: '#ffffff' },
    error:      { main: '#f16b6b' },
    warning:    { main: '#f0c060', contrastText: '#1a1200' },
    background: { default: '#0c0e12', paper: '#151820' },
    text: {
      primary:   '#dde2f0',
      secondary: '#7c87a6',
      disabled:  '#404a62',
    },
    divider: '#252b3b',
    action: {
      hover:    'rgba(221,226,240,0.05)',
      selected: 'rgba(124,106,247,0.12)',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none', backgroundImage: 'none' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, fontSize: 14 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 0 },
      },
    },
    MuiCheckbox: {
      defaultProps: { disableRipple: true },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 100 },
      },
    },
  },
})

export default theme
```

Key changes from current:
- Add `mode: 'dark'` — MUI automatically flips many defaults (inputs, dialogs, menus)
- `primary.main` → `#7c6af7` (violet instead of green)
- `background.default` → `#0c0e12`, `background.paper` → `#151820`
- Explicit `text`, `divider`, and `action` palette entries
- `MuiPaper: backgroundImage: none` — required in dark mode to suppress MUI's default elevation overlay gradient
- `shape.borderRadius: 10` → used as the base multiplier

---

### 2. `frontend/src/App.css`

Update all CSS custom properties to dark values. These are used directly by components via `var()` references, and as fallbacks for things not covered by MUI.

```css
:root {
  --bg:           #0c0e12;
  --surface:      #151820;
  --border:       #252b3b;
  --text:         #dde2f0;
  --muted:        #7c87a6;
  --accent:       #7c6af7;
  --accent-light: #2a2454;
  --danger:       #f16b6b;
  --radius:       10px;
  --shadow:       0 0 0 1px #252b3b, 0 4px 20px rgba(0,0,0,0.4);
}
```

Lines 80 and 125: replace hardcoded `#ccc` hover border → `#252b3b`
Line 163: replace hardcoded `#fdf0ee` error bg → `rgba(241,107,107,0.12)`

---

### 3. `frontend/src/components/Todos.tsx` — Lines 28–46

The priority color map is fully hardcoded with light-mode values. Replace with dark-friendly equivalents:

```ts
const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  High:   { bg: 'rgba(241,107,107,0.18)', color: '#f16b6b' },
  Medium: { bg: 'rgba(240,192,96,0.18)',  color: '#f0c060' },
  Low:    { bg: 'rgba(124,106,247,0.14)', color: '#a89cf7' },
}
```

---

### 4. `frontend/src/components/Calendar.tsx` — Line 66

The default event color is a light-mode blue:

```ts
const DEFAULT_EVENT_COLOR = '#6d7af7'  // was '#1976d2'
```

This only affects events that come back from the API without a color set. The brighter blue-violet reads well on dark surfaces.

---

### 5. `frontend/index.html`

Update the PWA theme-color meta tag and status bar style:

```html
<!-- line 8 -->
<meta name="theme-color" content="#151820" />

<!-- line 10 — use black-translucent so the status bar blends into the dark app -->
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

---

### 6. `frontend/vite.config.ts`

Update the PWA manifest colors (currently set to `#fef9c3` which already mismatches the app):

```ts
theme_color: '#151820',
background_color: '#0c0e12',
```

---

## What changes automatically

Because most components use MUI semantic tokens (`background.paper`, `text.secondary`, `divider`, `primary.main`, `action.hover`), enabling `mode: 'dark'` plus updating the palette propagates to:

- All `Dialog` and `Drawer` backgrounds
- All `TextField` and `Autocomplete` inputs (border, label, fill)
- All `Chip` default colors
- `BottomNavigation` background (it uses `background.paper`)
- `AppBar` background (overridden to `background.paper` already)
- `Skeleton` shimmer color
- `Divider` color
- `IconButton` hover states
- `Alert` and `Snackbar` variants
- `CircularProgress` color

Hardcoded `rgba(0,0,0,0.06)` box-shadows scattered across components will become barely visible on dark — they're not harmful but can be removed in a follow-up pass if desired.

---

## Scope summary

| File | Type of change | Effort |
|---|---|---|
| `theme.ts` | Full rewrite (~35 lines) | Low |
| `App.css` | Update 10 variable values + 3 hardcoded lines | Low |
| `Todos.tsx` lines 28–46 | Replace priority color map | Low |
| `Calendar.tsx` line 66 | One constant value | Trivial |
| `index.html` lines 8, 10 | Two attribute values | Trivial |
| `vite.config.ts` lines 16–17 | Two string values | Trivial |

Total: ~6 files, no structural changes. All component JSX stays the same.

---

## Testing checklist

- [ ] Home dashboard — summary cards, random recipe card
- [ ] Calendar — events render with correct colors, today highlight uses primary
- [ ] Todos — all three priority badge colors visible; status chips readable
- [ ] Shopping list — checked items (strikethrough), FAB visible, store group headers
- [ ] Inventory — 2-col grid legible
- [ ] Recipes — grid cards, photo placeholders, type chips, search dropdown
- [ ] Recipe detail — ingredient list, back navigation
- [ ] Recipe form — all inputs, drag handles, photo upload button
- [ ] Item form dialog — all fields, store chip toggles
- [ ] Login / Account setup pages
- [ ] Offline alert banner
- [ ] Bottom navigation — active/inactive states
- [ ] Install to home screen — check splash screen color and status bar on iOS/Android
