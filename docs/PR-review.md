PR Review: feat(todos): To-Dos v2 — full overhaul (#37) ￼

+1,241 / -386 across 21 files. This adds categories, assignees, due dates, priority, frequency, URLs, notes, sort order, a Kanban board view with drag-and-drop (@dnd-kit), a full-page form, a settings page, and a new workflow mode (simple vs. board). Solid feature overall — the architecture is clean and consistent with the existing codebase. A few things to address:

Must fix ￼

1. ‎`reorderTodos` does N sequential awaits instead of ‎`DB.batch()`

‎`worker/src/routes/todos-d1.ts` lines 114–126. The loop runs a separate ‎`await env.DB.prepare(...).run()` for each ID. This is slow (N round trips to D1) and not atomic — a failure partway through leaves sort_order in an inconsistent state. Use ‎`env.DB.batch()`:

```ts
const stmts = ids.map((id, i) =>
  env.DB.prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND household_id = ?')
    .bind(i, now, id, ctx.householdId)
)
await env.DB.batch(stmts)

```

2. Optimistic create ignores ‎`data.status`

‎`frontend/src/api/todos.ts` line 37 hardcodes ‎`status: 'Todo'` in the optimistic update, but the mutation payload can include a custom ‎`status` (the form allows setting it on create). This causes a brief flicker where the card appears as “Todo” then jumps to the actual status on server response. Should be:

```ts
status: data.status ?? 'Todo',

```

3. ‎`updateTodoSettings` has no role check

‎`worker/src/routes/household.ts` — ‎`updateTodoSettings` only checks ‎`ctx.householdId` but not the user’s role. The frontend correctly hides the toggle for non-owners (‎`TodosSettings.tsx` line 67), but the API endpoint is unprotected. Any household member can change the workflow by hitting the endpoint directly. Add an owner check like the other admin endpoints:

```ts
if (ctx.role !== 'owner') return err(403, 'Only the owner can change todo settings')

```

Should fix ￼

4. Can’t drop into a collapsed Done column

‎`Todos.tsx` — The ‎`useDroppable` ref is on the card-list div inside ‎`CollapsibleContent`. When the Done column is collapsed (its default state), the droppable has no rect, so drag-and-drop can’t target it. Users will try to drag a todo to “Done” and wonder why it doesn’t work. Consider either: (a) auto-expanding the column when a drag enters its header area, or (b) placing a secondary droppable on the header trigger itself.

5. ‎`handleWorkflowChange` fires N+1 uncoordinated mutations

‎`TodosSettings.tsx` lines 53-57. Switching from “board” to “simple” calls ‎`updateWorkflow()` then ‎`updateTodo.mutate()` for each “In progress”/“Blocked” todo. If the workflow update succeeds but one of the status updates fails, you end up in “simple” mode with orphaned “In progress” or “Blocked” statuses. Consider batching through a single API call (e.g., ‎`PATCH /household/todo-settings` could also reset statuses server-side).

6. ‎`reorderTodos` lacks input validation

‎`worker/src/routes/todos-d1.ts` — No runtime check that ‎`ids` is an array of strings, non-empty, etc. A malformed request (e.g., ‎`{ ids: null }`) will throw an unhandled error. Add a guard:

```ts
if (!Array.isArray(ids) || ids.length === 0) return Response.json({ error: 'Invalid ids' }, { status: 400 })

```

Nits / minor ￼

7. Dead ‎`ref` prop on ‎`TodoCard`

‎`TodoCardProps` declares ‎`ref?: React.Ref<HTMLDivElement>` but the component destructures everything except ‎`ref` and never uses it. Remove from the interface.

8. ‎`memberInitials` is duplicated

Defined identically in both ‎`Home.tsx` (line 281) and ‎`Todos.tsx`. Extract to a shared util or import from one place.

9. Desktop skeleton suggests side-by-side columns, but the board renders stacked

‎`TodosSkeleton` renders horizontal columns for desktop (‎`flex gap-3`), but ‎`KanbanColumn` renders vertically stacked (‎`mb-2`). The loading state sets an expectation the final layout doesn’t match. Either update the skeleton or consider a multi-column layout for desktop.

