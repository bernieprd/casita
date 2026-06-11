**Bug: Bottom sheet drawers fly off the top of the screen when the mobile keyboard opens (PWA on iOS/Android)**

**Root cause**: Four components apply `style={{ bottom: keyboardOffset, transition: 'bottom 150ms ease-out' }}` directly to vaul’s `<DrawerContent>`. Vaul internally uses `position: fixed; bottom: 0` plus CSS `transform: translateY()` to manage drawer positioning and its open/close animation. Setting `bottom: 300px` (keyboard height) on `DrawerContent` conflicts with vaul’s transform-based positioning, causing the drawer to be pushed way above the viewport.

**Affected files**:

- `frontend/src/components/ItemFormDialog.tsx` — sets `bottom: keyboardOffset` and `maxHeight` on DrawerContent
- `frontend/src/components/IncompleteItemsSheet.tsx` — same pattern
- `frontend/src/components/MergeDuplicatesSheet.tsx` — same pattern
- `frontend/src/components/Todos.tsx` (the `TodoDetailSheet` sub-component) — same pattern
- `frontend/src/useKeyboardOffset.ts` — the hook supplying the offset value
- `frontend/src/components/ui/drawer.tsx` — the base drawer component (vaul wrapper)
- `frontend/index.html` — viewport meta tag

**What to fix**:

1. **Remove all** `bottom: keyboardOffset` **and keyboard-dependent** `maxHeight` **inline styles** from `DrawerContent` in all four component files.
2. **Remove** `useKeyboardOffset` **imports** from those files (and delete `useKeyboardOffset.ts` if nothing else uses it).
3. **Fix the viewport meta tag** in `frontend/index.html`: change the viewport content to `width=device-width, initial-scale=1.0, interactive-widget=resizes-content, viewport-fit=cover`. The `interactive-widget=resizes-content` directive tells the browser to shrink the layout viewport when the keyboard opens, so `bottom: 0` fixed elements (like vaul drawers) naturally stay above the keyboard. This works on Android Chrome 108+.
4. **For iOS Safari / PWA standalone** (where `interactive-widget` isn’t supported): modify `frontend/src/components/ui/drawer.tsx` to handle keyboard offset at the vaul wrapper level. In the `DrawerContent` component, use the Visual Viewport API to set a CSS custom property (`-keyboard-offset`) on the document element when the keyboard opens, then use `env(safe-area-inset-bottom)` plus that custom property to add `padding-bottom` to the inner drawer content (NOT `bottom` on the container). This avoids fighting vaul’s fixed + transform positioning.
5. **Constrain drawer height properly**: instead of computing `maxHeight` from `window.innerHeight - keyboardOffset`, use CSS `max-h-[80dvh]` (dynamic viewport height units) on DrawerContent, which automatically accounts for keyboard presence on browsers that support `dvh`.

**Key constraint**: Do NOT set the `bottom` CSS property on DrawerContent — that conflicts with vaul’s positioning. Keyboard compensation should happen via viewport resize (`interactive-widget`), `dvh` units, or `padding-bottom` on the drawer’s inner content wrapper.