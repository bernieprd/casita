
Bug ￼

DST breakage in week navigation — ‎`Calendar.tsx` navigates weeks using millisecond arithmetic:

```ts
new Date(d.getTime() + dir * 7 * 24 * 60 * 60 * 1000)

```

A week isn’t always exactly 604,800,000ms. At DST transitions this will shift the anchor by ±1 hour, and over time the week start will drift. Use date arithmetic instead:

```ts
const next = new Date(d)
next.setDate(next.getDate() + dir * 7)
return next

```

Should Fix ￼

‎`formatHour` in ‎`CalendarWeekView.tsx` is hardcoded to English AM/PM. The rest of the app uses ‎`useLocale()` and ‎`toLocaleTimeString()` consistently. A user in the ‎`es` or ‎`pt-PT` locale would see Spanish/Portuguese everywhere except the hour labels in week view. Something like:

```ts
function formatHour(h: number, locale: string): string {
  if (h === 0) return ''
  return new Date(2024, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric' })
}

```

Sequential KV fetches in ‎`listUserCalendars` — the ‎`for...of` loop fetches each account’s Google calendar list one at a time. With 2-3 accounts this adds noticeable latency. Switch to ‎`Promise.allSettled` for parallel fetching, same pattern you already used in ‎`getCalendarEvents`.

Worth Noting ￼

‎`invalid_grant` doesn’t clean connected account listing — when ‎`getValidAccessToken` hits an ‎`invalid_grant`, it deletes the token but leaves the account in ‎`connected_accounts`. The user sees the account listed in Settings but gets no events. They’d have to know to disconnect and reconnect. Consider either removing the account from the index or surfacing a “re-authenticate” state in the UI.

‎`dayKey` is defined three times with slightly different implementations across ‎`Calendar.tsx`, ‎`CalendarMonthView.tsx`, and ‎`CalendarWeekView.tsx`. Same for ‎`getWeekStart` (in ‎`Calendar.tsx` and ‎`CalendarWeekView.tsx`). These should live in a shared ‎`lib/calendar-utils.ts`.

Magic height — ‎`CalendarWeekView.tsx` uses ‎`calc(100dvh - 180px)`. If the header or nav height changes, this breaks silently.

Multi-day events appear only on their start day in both week and month views. This is fine as a v1 limitation but worth tracking.

Current-time indicator (the red line in week view) is computed at render time and won’t move. A 60-second interval to update ‎`currentMinutes` would keep it accurate during long sessions.