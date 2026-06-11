import { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useConceptList,
  useCreateConcept,
  useRenameConcept,
  useDeleteConcept,
  useReorderConcepts,
} from '@/api/concepts'
import type { ConceptType, ConceptItem } from '@/api/concepts'

// ── Props ──────────────────────────────────────────────────────────────────────

interface ConceptManagerProps {
  type: ConceptType
  label: string
  addPlaceholder: string
  ownerOnly?: boolean
}

// ── SortableRow ────────────────────────────────────────────────────────────────

interface SortableRowProps {
  item: ConceptItem
  label: string
  ownerOnly: boolean
  isEditing: boolean
  editName: string
  deleteErrorId: string | null
  deleteErrorMsg: string | null
  onEditStart: (id: string, name: string) => void
  onEditChange: (val: string) => void
  onEditConfirm: (id: string) => void
  onEditCancel: () => void
  onDeleteRequest: (item: ConceptItem) => void
  onDismissError: () => void
  rowRef?: (el: HTMLDivElement | null) => void
}

function SortableRow({
  item,
  label,
  ownerOnly,
  isEditing,
  editName,
  deleteErrorId,
  deleteErrorMsg,
  onEditStart,
  onEditChange,
  onEditConfirm,
  onEditCancel,
  onDeleteRequest,
  onDismissError,
  rowRef,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasError = deleteErrorId === item.id && deleteErrorMsg

  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        rowRef?.(el)
      }}
      style={style}
      role="listitem"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 bg-card border rounded-md">
        {ownerOnly && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none flex-shrink-0"
            aria-label={`Drag to reorder ${item.name}`}
            tabIndex={0}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => onEditChange(e.target.value)}
              autoFocus
              className="h-7 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditConfirm(item.id)
                if (e.key === 'Escape') onEditCancel()
              }}
              onBlur={() => onEditConfirm(item.id)}
            />
          ) : (
            <span className="text-sm truncate block">{item.name}</span>
          )}
        </div>

        {ownerOnly && !isEditing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`Edit ${item.name}`}
              onClick={() => onEditStart(item.id, item.name)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              aria-label={`Delete ${item.name}`}
              onClick={() => onDeleteRequest(item)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {hasError && (
        <div className="flex items-center gap-2 mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="flex-1">{deleteErrorMsg}</span>
          <button
            onClick={onDismissError}
            className="text-amber-600 hover:text-amber-800 flex-shrink-0"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── ConceptManager ─────────────────────────────────────────────────────────────

export function ConceptManager({ type, label, addPlaceholder, ownerOnly = false }: ConceptManagerProps) {
  const { data: serverItems = [], isLoading, isError } = useConceptList(type)
  const { mutate: create, isPending: creating } = useCreateConcept(type)
  const { mutate: rename } = useRenameConcept(type)
  const { mutate: remove } = useDeleteConcept(type)
  const { mutate: reorder } = useReorderConcepts(type)

  // Local reordered state — mirrors server but allows optimistic reordering
  const [items, setItems] = useState<ConceptItem[]>([])
  const [itemsInitialized, setItemsInitialized] = useState(false)

  // Sync server data into local state only on first load or when items list changes from outside
  if (!itemsInitialized && serverItems.length > 0) {
    setItems([...serverItems].sort((a, b) => a.sort_order - b.sort_order))
    setItemsInitialized(true)
  }
  // If server returns empty after being non-empty (e.g. last item deleted), sync
  if (itemsInitialized && serverItems.length === 0 && items.length > 0) {
    setItems([])
  }
  // If items were added from another source or new items arrived, merge carefully
  if (itemsInitialized && serverItems.length !== items.length) {
    setItems([...serverItems].sort((a, b) => a.sort_order - b.sort_order))
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletePending, setDeletePending] = useState<ConceptItem | null>(null)
  const [deleteErrorId, setDeleteErrorId] = useState<string | null>(null)
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')

  // Refs for focus management
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const addInputRef = useRef<HTMLInputElement>(null)

  const setRowRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }, [])

  // ── dnd-kit sensors ──────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id)
      const newIndex = prev.findIndex((i) => i.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      reorder(reordered)
      return reordered
    })
  }

  // ── Edit handlers ────────────────────────────────────────────────────────────

  function handleEditStart(id: string, name: string) {
    setEditingId(id)
    setEditName(name)
  }

  function handleEditConfirm(id: string) {
    const trimmed = editName.trim()
    if (trimmed) rename({ id, name: trimmed })
    setEditingId(null)
    setEditName('')
  }

  function handleEditCancel() {
    setEditingId(null)
    setEditName('')
  }

  // ── Delete handlers ──────────────────────────────────────────────────────────

  function handleDeleteRequest(item: ConceptItem) {
    setDeleteErrorId(null)
    setDeleteErrorMsg(null)
    setDeletePending(item)
  }

  function handleDeleteConfirm() {
    if (!deletePending) return
    const targetId = deletePending.id
    const currentIndex = items.findIndex((i) => i.id === targetId)

    remove(targetId, {
      onSuccess: () => {
        setDeletePending(null)
        // Focus previous item or add button
        setTimeout(() => {
          if (currentIndex > 0) {
            const prevId = items[currentIndex - 1]?.id
            if (prevId) {
              const el = rowRefs.current.get(prevId)
              const btn = el?.querySelector('button')
              btn?.focus()
            }
          } else {
            addButtonRef.current?.focus()
          }
        }, 0)
      },
      onError: (err: unknown) => {
        const msg = (err as { message?: string })?.message ?? 'Could not delete'
        setDeletePending(null)
        setDeleteErrorId(targetId)
        setDeleteErrorMsg(msg)
      },
    })
  }

  function handleDeleteCancel() {
    setDeletePending(null)
  }

  // ── Add handlers ─────────────────────────────────────────────────────────────

  function handleStartAdd() {
    setAddingNew(true)
    setNewName('')
    setTimeout(() => addInputRef.current?.focus(), 0)
  }

  function handleConfirmAdd() {
    const trimmed = newName.trim()
    if (!trimmed) {
      setAddingNew(false)
      return
    }
    create(trimmed, {
      onSuccess: (created) => {
        setAddingNew(false)
        setNewName('')
        // Focus the newly created row
        setTimeout(() => {
          if (created?.id) {
            const el = rowRefs.current.get(created.id)
            const btn = el?.querySelector('button')
            btn?.focus()
          }
        }, 100)
      },
      onError: () => {
        setAddingNew(false)
        setNewName('')
      },
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mb-6">
      <p className="text-sm font-semibold mb-2">{label}</p>

      {isLoading ? (
        <div role="list" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} role="listitem">
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Could not load — check your connection</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div role="list" className="space-y-1.5">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  label={label}
                  ownerOnly={ownerOnly}
                  isEditing={editingId === item.id}
                  editName={editName}
                  deleteErrorId={deleteErrorId}
                  deleteErrorMsg={deleteErrorMsg}
                  onEditStart={handleEditStart}
                  onEditChange={setEditName}
                  onEditConfirm={handleEditConfirm}
                  onEditCancel={handleEditCancel}
                  onDeleteRequest={handleDeleteRequest}
                  onDismissError={() => {
                    setDeleteErrorId(null)
                    setDeleteErrorMsg(null)
                  }}
                  rowRef={setRowRef(item.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add row — only shown for owners */}
      {ownerOnly && !isLoading && !isError && (
        <div className="mt-2">
          {addingNew ? (
            <Input
              ref={addInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={addPlaceholder}
              className="h-9 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmAdd()
                if (e.key === 'Escape') setAddingNew(false)
              }}
              onBlur={handleConfirmAdd}
              disabled={creating}
            />
          ) : (
            <button
              ref={addButtonRef}
              className="text-sm text-muted-foreground hover:text-foreground px-1 py-1"
              onClick={handleStartAdd}
            >
              + {addPlaceholder}
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletePending} onOpenChange={(open) => { if (!open) handleDeleteCancel() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletePending?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Items using this {label.toLowerCase()} will have it cleared. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                handleDeleteConfirm()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ConceptManager
