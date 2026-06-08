# Casita Theming — Per-Household Settings + Border Radius Fix + Heading/Body Fonts

## Context

Theme preferences are currently stored only in `localStorage` — each browser/device gets its own theme and household members never see the same thing. The `--radius` CSS variable is set dynamically but Tailwind v4's `rounded-*` utility classes ignore it (they use hardcoded default sizes). The single `fontFamily` setting doesn't distinguish between headings and body text. This plan fixes all three and lays the groundwork for further customization.

---

## 1. Fix Border Radius — `frontend/src/index.css`

**Root cause**: Tailwind v4 `@theme inline` defines `--radius: var(--radius)` but doesn't remap `--radius-sm/md/lg/xl`, so `rounded-md`, `rounded-lg`, etc. still use Tailwind's hardcoded defaults.

**Fix**: Add radius scale mappings to the `@theme inline` block (shadcn's recommended scale):

```css
@theme inline {
  /* …existing color vars… */
  --radius-sm:  calc(var(--radius) - 4px);
  --radius-md:  calc(var(--radius) - 2px);
  --radius-lg:  var(--radius);
  --radius-xl:  calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
}
```

This makes `rounded-md`, `rounded-lg`, etc. resolve to `var(--radius)` offsets at runtime. `rounded-full` stays circular. No component files need to change.

---

## 2. Add Heading/Body Font Split

### `frontend/src/lib/theme.ts`
- Rename `fontFamily` → `bodyFont` in `ThemePrefs` and `DEFAULT_THEME`
- Add `headingFont: string` to `ThemePrefs` (default: same as bodyFont)
- Add a `HEADING_FONT_OPTIONS` array (same options as `FONT_OPTIONS`, but includes one serif-heavy choice like Playfair Display as default-highlighted)
- `applyTheme()` sets:
  - `--font-sans` ← `prefs.bodyFont`  
  - `--font-heading` ← `prefs.headingFont`
- `loadGoogleFont` called for both fonts on load
- `loadTheme()` must handle migration: if stored prefs have old `fontFamily` key, map it to both `bodyFont` and `headingFont`

### `frontend/src/index.css`
- Add `--font-heading: var(--font-sans)` (fallback) to `:root`
- Add `--font-heading: var(--font-heading)` to `@theme inline`
- Add base style rule:
  ```css
  @layer base {
    h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); }
  }
  ```

### `frontend/src/components/ThemeCustomizer.tsx`
- Replace the single "Font" `<Select>` with two selects:
  - **Heading font** — uses `HEADING_FONT_OPTIONS`
  - **Body font** — uses `FONT_OPTIONS`
- Each calls `loadGoogleFont` on selection and updates the relevant field in `prefs`

---

## 3. Per-Household Theme — Server Sync

### Backend

**Migration** — `worker/src/db/migrations/004_household_settings.sql`:
```sql
ALTER TABLE households ADD COLUMN settings TEXT; -- JSON, nullable
```

**New route handlers** in `worker/src/routes/household.ts`:
```
GET  /household/settings  → any member: returns parsed JSON or {}
PATCH /household/settings → owner only: validates & stores JSON blob
```

The stored JSON shape matches `ThemePrefs` (`primaryHsl`, `headingFont`, `bodyFont`, `radius`, `colorScheme`). The GET handler returns an empty object `{}` when settings is NULL, so the frontend always has a valid (possibly empty) object to merge against `DEFAULT_THEME`.

**Register routes** in `worker/src/index.ts`:
```
['GET',   /household/settings, getHouseholdSettings],
['PATCH', /household/settings, updateHouseholdSettings],
```

### Frontend

**`frontend/src/api/household.ts`** — add:
- `useHouseholdTheme()` query → `GET /household/settings` → returns `Partial<ThemePrefs>`
- `useUpdateHouseholdTheme()` mutation → `PATCH /household/settings`

**`frontend/src/hooks/useTheme.ts`** — extend to accept an optional `serverPrefs` param:
- On mount: merge `DEFAULT_THEME` → `localStorage` prefs → `serverPrefs` (server wins)
- `setPrefs(next)`:
  - Always: `applyTheme(next)` + `localStorage` save (for offline/pre-auth fallback)
  - If owner: also fire `PATCH /household/settings`

**`frontend/src/components/Settings.tsx`**:
- Pass `isOwner` down to `ThemeCustomizer` as a `readOnly` prop
- If `readOnly` (member): show current theme settings as display-only, hide the "Customize theme" button or show a note "Managed by the household owner"
- Wire up `useHouseholdTheme` and `useUpdateHouseholdTheme` to feed into `useTheme`

**`frontend/src/main.tsx`** (no change needed): still applies `loadTheme()` immediately from localStorage to avoid flash. Server settings are applied once the query resolves.

---

## 4. Light / Dark Mode Toggle

### `frontend/src/lib/theme.ts`

Add a `colorScheme: 'light' | 'dark' | 'system'` field to `ThemePrefs`:

```ts
export interface ThemePrefs {
  primaryHsl: string;
  radius: number;
  headingFont: string;
  bodyFont: string;
  colorScheme: 'light' | 'dark' | 'system'; // new
}

export const DEFAULT_THEME: ThemePrefs = {
  // …existing defaults…
  colorScheme: 'system',
};
```

Update `applyTheme()` to toggle the `.dark` class on `<html>` based on `colorScheme`:

```ts
function applyColorScheme(scheme: ThemePrefs['colorScheme']) {
  const html = document.documentElement;
  if (scheme === 'dark') {
    html.classList.add('dark');
  } else if (scheme === 'light') {
    html.classList.remove('dark');
  } else {
    // 'system'
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', prefersDark);
  }
}
```

For `'system'`, also attach a `MediaQueryList` change listener so the UI reacts live when the OS preference changes — without a page reload:

```ts
let _mqlListener: (() => void) | null = null;

export function applyTheme(prefs: ThemePrefs) {
  // …existing CSS custom property assignments…

  // Clean up any previous system listener
  if (_mqlListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', _mqlListener);
    _mqlListener = null;
  }

  applyColorScheme(prefs.colorScheme);

  if (prefs.colorScheme === 'system') {
    _mqlListener = () => applyColorScheme('system');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _mqlListener);
  }
}
```

`loadTheme()` should handle migration for stored prefs that predate this field by defaulting to `'system'` if the key is absent.

### `frontend/src/index.css`

The shadcn scaffold already generates a `.dark` selector block that overrides all CSS custom properties (background, foreground, card, popover, primary, etc.) with dark-mode HSL values. No structural changes are needed here.

The `--primary` variable that the ThemeCustomizer color picker writes to already lives at `:root` level. The dark-mode block in `.dark` overrides the other surface/text variables but leaves `--primary` as set by the color picker — so the user's chosen accent color continues to apply in both light and dark modes without any extra wiring.

### `frontend/src/components/ThemeCustomizer.tsx`

Add a three-way toggle at the **top of the customizer**, above the color picker, using shadcn's `<ToggleGroup>` component with lucide-react icons:

```tsx
import { Sun, SunMoon, Moon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Inside ThemeCustomizer render, before the color picker:
<ToggleGroup
  type="single"
  value={prefs.colorScheme}
  onValueChange={(value) => {
    if (!value) return; // prevent deselection
    const next = { ...prefs, colorScheme: value as ThemePrefs['colorScheme'] };
    setPrefs(next);
  }}
>
  <ToggleGroupItem value="light" aria-label="Light mode">
    <Sun className="h-4 w-4" />
    <span className="ml-1 text-sm">Light</span>
  </ToggleGroupItem>
  <ToggleGroupItem value="system" aria-label="System default">
    <SunMoon className="h-4 w-4" />
    <span className="ml-1 text-sm">System</span>
  </ToggleGroupItem>
  <ToggleGroupItem value="dark" aria-label="Dark mode">
    <Moon className="h-4 w-4" />
    <span className="ml-1 text-sm">Dark</span>
  </ToggleGroupItem>
</ToggleGroup>
```

The `SunMoon` icon from lucide-react represents the half-light/half-dark "System" state. No new shadcn components need to be installed — `toggle-group` is already available as part of the standard shadcn component set.

### Household sync

`colorScheme` is part of the `ThemePrefs` shape and therefore travels in the same `households.settings` JSON blob as all other preferences. No additional backend changes are needed beyond what is already described in section 3. When a household owner changes the color scheme, it is written via the same `PATCH /household/settings` call. Members receive it on the next `GET /household/settings` fetch and `applyTheme()` applies it immediately, including setting up or tearing down the system media-query listener as appropriate.

---

## 5. Verification

1. **Border radius**: Open the app → Settings → Customize theme → drag the radius slider. Buttons, inputs, cards, dialogs should all visibly change corner roundness.
2. **Heading font**: Select a distinct heading font (e.g. Playfair Display for heading, Inter for body). Page headings like "Casita" in the header and section labels should change, while body text stays in the body font.
3. **Household sync**: Log in as the owner, set a theme, log out. Log in as a member on a different browser/device. The member should see the same color/radius/fonts without touching settings.
4. **Member restriction**: Member opens Settings → "Appearance" section shows current theme read-only, no "Customize theme" button (or it's disabled with a note).
5. **Offline fallback**: Disable network. App should still load with the last-known theme from localStorage.
6. **Light/Dark toggle**: Switch to Dark mode → UI flips to dark palette. Switch back to Light → UI flips to light palette. Set System → UI matches the current OS preference.
7. **Live system update**: With color scheme set to System, change the OS dark mode preference (e.g. via macOS System Settings or the OS quick-toggle) → the UI updates live without a page refresh.
8. **Color scheme household sync**: Log in as the owner on one device, set Dark mode, save. Log in as a member on a different device → the member's UI loads in Dark mode, matching the household setting.
