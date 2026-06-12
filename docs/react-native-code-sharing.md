# React Native + Web Code Sharing Plan

## Background

Casita is currently a React + Vite PWA deployed on Cloudflare Pages, with a Capacitor v8 shell that
packages it as native Android/iOS apps. The Capacitor approach shares ~100% of code across web and
mobile, but trades native UI fidelity for speed — animations, gestures, and inputs are HTML-based.

This document describes what it would take to introduce a **React Native** target that shares all
business logic with the web app while rendering truly native UI on Android and iOS, without
breaking the existing web or Capacitor builds.

---

## Decision summary

> **Capacitor is almost certainly sufficient for a household app.** Pursue React Native only if you
> need native-feel gestures/animations or plan to charge for the app and need App Store
> polish to justify the investment. The total shared-code architecture described here is a
> **~5–6 month engineering project**.

| Approach | Shared code | Native feel | App Store | Effort |
|---|---|---|---|---|
| **Capacitor (current)** | ~100% | Medium | ✓ | Done |
| **React Native (shared core)** | ~60–70% | High | ✓ | 5–6 months |

---

## Target architecture

```
casita/                          ← pnpm monorepo root
├── frontend/                    ← existing React + Vite web app (unchanged)
├── native/                      ← new React Native / Expo app
├── worker/                      ← existing Cloudflare Worker (unchanged)
└── packages/
    └── core/                    ← new shared package
        ├── src/
        │   ├── types/           ← all data types (Item, Recipe, Todo, etc.)
        │   ├── api/             ← raw fetch functions (no React Query hooks)
        │   │   ├── client.ts    ← abstract API client interface
        │   │   ├── items.ts
        │   │   ├── recipes.ts
        │   │   ├── todos.ts
        │   │   ├── household.ts
        │   │   ├── concepts.ts
        │   │   ├── calendar.ts
        │   │   └── index.ts
        │   ├── utils/
        │   │   ├── formatting.ts    ← formatFrequency(), memberInitials()
        │   │   └── validation.ts    ← safeUrl()
        │   └── theme/
        │       ├── constants.ts     ← COLOR_PRESETS, FONT_OPTIONS, DEFAULT_THEME
        │       └── types.ts         ← ThemePrefs, ColorPreset
        └── package.json
```

### What goes into `packages/core`

**Fully shareable (zero changes needed):**
- All TypeScript interfaces — `Item`, `Recipe`, `RecipeWithBlocks`, `Block`, `RecipeIngredient`,
  `Todo`, `CalendarEvent`, `HouseholdSettings`, `ConceptItem`, etc.
- Raw API functions — `itemsApi.*`, `recipesApi.*`, `todosApi.*`, `householdApi.*`, etc. These are
  plain `fetch` wrappers with no React or browser dependencies.
- Pure utility functions — `memberInitials()`, `formatFrequency()`, `safeUrl()`
- Theme constants — `COLOR_PRESETS`, `FONT_OPTIONS`, `DEFAULT_THEME`, type definitions

**Needs a platform adapter (abstract the interface, implement per-platform):**

| Concern | Web implementation | RN implementation |
|---|---|---|
| Token storage | `localStorage` | `@react-native-async-storage/async-storage` |
| Theme application | CSS variables on `document.documentElement` | React Navigation `ThemeProvider` |
| Network status | `navigator.onLine` + `online`/`offline` events | `@react-native-community/netinfo` |
| File download (account export) | `document.createElement('a')` + blob URL | `react-native-share` or `expo-sharing` |
| Google OAuth redirect | `window.location.href` | In-app browser (`expo-web-browser`) |
| Photo upload | `FormData` + file input | `expo-image-picker` + `FormData` polyfill |

**Stay web-only (do not extract):**
- TanStack React Query hooks (`useQuery`, `useMutation`) — these are React-compatible across both
  web and RN, but the query key definitions stay with each app since cache invalidation strategy
  may differ.
- `useIsMobile()` — replaced by `useWindowDimensions()` in RN.
- `useInstallPrompt()` — PWA-only, no RN equivalent.
- `cn()` utility — Tailwind class merging; web-only.
- Clerk React integration — `@clerk/clerk-react` is web-specific.

---

## Key technology choices for `native/`

### Framework: Expo (managed workflow)
Use **Expo** rather than bare React Native. Reasons:
- Over-the-air updates via EAS Update (critical for a family app — no waiting for store reviews)
- Expo's managed plugins cover camera, file system, notifications without native code
- EAS Build produces signed APK/IPA without needing macOS for Android
- Can eject to bare workflow later if needed

### Styling: NativeWind v4
Use **NativeWind** (Tailwind → React Native StyleSheet) to keep styling consistent with the web
app. Caveat: NativeWind covers ~60% of Tailwind's surface area — some classes have no RN
equivalent and will need inline styles or custom components. Avoid complex CSS tricks (grid,
position:sticky, backdrop-filter).

### Auth: Clerk Expo SDK
Clerk provides `@clerk/clerk-expo` — same auth logic, same JWTs, different UI entry points
(Expo WebBrowser-based OAuth flows). Token is passed to `packages/core`'s API client via the same
pluggable `setTokenGetter()` interface that the web app already uses.

### Navigation: React Navigation v7
Replaces React Router. The structure maps naturally:

| Web (React Router) | Native (React Navigation) |
|---|---|
| Bottom tab bar (App.tsx) | `createBottomTabNavigator` |
| `/recipes/:id` route | Stack navigator inside Recipes tab |
| `/todos/new` full-screen | Stack screen with `presentation: 'modal'` |
| `useNavigate()` | `useNavigation().navigate()` |
| `useParams()` | `useRoute().params` |
| `useBlocker()` (unsaved changes) | `navigation.addListener('beforeRemove', ...)` |

### State: TanStack React Query (same as web)
React Query works in React Native with no changes. The same query functions from `packages/core`
are wrapped in hooks inside `native/src/api/` — same pattern as `frontend/src/api/` but without
the browser-specific side effects.

---

## Component rewrite effort

The UI layer **cannot be shared** — every component needs a native rewrite. Here's the complexity
breakdown:

### Low effort (straightforward mapping)
- Auth screens, household setup, calendar view, settings menus, changelog
- Dialogs → `Modal`, Cards → `View` + shadow styles, Badges → `View` + `Text`
- Tab navigation, stack navigation, settings hierarchy

### Medium effort (platform adaptation needed)
- **Shopping list** — sticky group headers use `FlatList stickyHeaderIndices`, swipe-to-delete
  uses `react-native-gesture-handler` `Swipeable`.
- **Todo list** — simple list view is straightforward; the collapsible sections use Reanimated.
- **Recipe grid + detail** — `FlatList` with `numColumns`, image loading with `expo-image`.
- **Bottom sheets** — replace `vaul` Drawer with `@gorhom/bottom-sheet`.
- **Date pickers** — replace `react-day-picker` with `@react-native-community/datetimepicker` or
  the Expo equivalent.
- **Autocomplete / combobox** — no `<input list>` in RN; build with `FlatList` + `TextInput`.

### High effort (significant re-architecture)
- **Kanban board (Todos)** — `@dnd-kit` is DOM-only. React Native Gesture Handler +
  `react-native-reanimated` can replicate the drag behaviour, but the cross-column dragging and
  custom collision detection logic needs to be rebuilt from scratch. Consider shipping Todos as a
  simple sortable list in the first release.
- **Recipe form** — The markdown editor relies on `setSelectionRange()` which does not exist on
  React Native's `TextInput`. Options: (a) ship a simplified plain-text notes field for v1 of the
  native app, (b) use a 3rd-party RN rich-text editor (`react-native-rich-editor`), (c) embed a
  WebView for just this screen.
- **Image upload** — Replace `<input type="file">` with `expo-image-picker`. Photo preview and
  crop work well but the API surface is different.

### Recommended phased scope

**Phase 1 — MVP (6–8 weeks)**
Home dashboard, Shopping list (no inventory), Todos (list view only, no kanban), Calendar,
Settings. Covers ~75% of daily usage.

**Phase 2 — Recipes + full Todos (4–6 weeks)**
Recipe grid, recipe detail, recipe form (plain-text description for now), Kanban board with
gesture reordering, ingredient toggles.

**Phase 3 — Full parity (3–4 weeks)**
Markdown editor (WebView embed or 3rd-party), image upload/crop, inventory management,
import wizard, advanced dnd interactions.

---

## Migration steps

### Step 1 — Create `packages/core`

1. Add `packages/core/` with its own `package.json` (`name: "@casita/core"`).
2. Move types from `frontend/src/api/types.ts` → `packages/core/src/types/index.ts`.
3. Move raw API functions (the non-hook parts of `items.ts`, `recipes.ts`, etc.) →
   `packages/core/src/api/`.
4. Move `memberInitials`, `formatFrequency`, `safeUrl`, theme constants →
   `packages/core/src/utils/` and `packages/core/src/theme/`.
5. Extract the abstract API client interface (token getter, base URL config) →
   `packages/core/src/api/client.ts`.
6. Update `frontend/` to import from `@casita/core` instead of its own copies.
7. Add `"@casita/core": "workspace:*"` to `frontend/package.json`.
8. Run `pnpm typecheck` across the whole monorepo.

### Step 2 — Bootstrap `native/` with Expo

```bash
cd casita
npx create-expo-app native --template blank-typescript
```

Configure `native/package.json`:
```json
{
  "dependencies": {
    "@casita/core": "workspace:*",
    "@clerk/clerk-expo": "^...",
    "@react-navigation/native": "^7",
    "@react-navigation/bottom-tabs": "^7",
    "@react-navigation/stack": "^7",
    "nativewind": "^4",
    "@tanstack/react-query": "^5",
    ...
  }
}
```

### Step 3 — Platform adapters

In `native/src/lib/`, implement the platform-specific versions of:
- `storage.ts` — wraps `AsyncStorage` behind the same interface as the web's `localStorage` calls
- `apiClient.ts` — calls `setTokenGetter(() => Clerk.session.getToken())` and sets the base URL
- `networkStatus.ts` — uses `NetInfo.addEventListener` instead of `window.addEventListener`

### Step 4 — Auth wiring

```tsx
// native/src/App.tsx
import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { setTokenGetter, setUnauthorizedHandler } from '@casita/core'

function ApiBootstrap() {
  const { getToken, signOut } = useAuth()
  setTokenGetter(() => getToken())
  setUnauthorizedHandler(() => signOut())
  return null
}
```

### Step 5 — Navigation skeleton

Set up the bottom tab navigator matching the web's 5 tabs (Home, Calendar, To-Dos, Shopping,
Recipes) with stack navigators inside each tab for detail/form screens.

### Step 6 — Implement screens phase by phase

Build each screen using React Native primitives + NativeWind. Reuse query logic from
`packages/core` (or identical hooks in `native/src/api/` that call the same raw functions).

---

## What doesn't change

- `worker/` — no changes to the Cloudflare Worker backend.
- `frontend/` — web app and Capacitor builds continue to work as today.
- `packages/core` is additive — it's extracted from `frontend/`, not a rewrite of it.
- The Cloudflare Pages deployment is unaffected.

---

## Rough timeline (single developer)

| Phase | Scope | Weeks |
|---|---|---|
| Core package extraction + Expo bootstrap | Steps 1–4 | 2–3 |
| Phase 1 MVP screens | Home, Shopping, Todos (list), Calendar, Settings | 6–8 |
| Phase 2 | Recipes, Kanban, Recipe form (simplified) | 4–6 |
| Phase 3 | Full parity, markdown editor, image upload | 3–4 |
| **Total** | | **15–21 weeks** |

With two developers working in parallel on different screens, compress Phase 1–3 to roughly
**10–14 weeks**.

---

## Open questions before starting

1. **Is App Store distribution the goal, or is Capacitor sufficient?** If the main driver is app
   store presence and polish, Capacitor already covers this. RN makes sense if you want platform-
   native feel (Reanimated spring physics, native inputs, haptics without Capacitor bridge).
2. **Markdown in recipes** — are you willing to ship plain-text in the v1 native app and iterate?
   This unblocks the recipe form by 2–3 weeks.
3. **Kanban in Todos** — same question. List-only Todos for v1 is a significant scope reduction.
4. **EAS budget** — Expo EAS Build free tier is limited. A paid plan ($29/mo) is needed for CI
   builds if doing frequent releases.
5. **Clerk RN support** — verify `@clerk/clerk-expo` supports the project's Clerk version before
   committing to this stack.
