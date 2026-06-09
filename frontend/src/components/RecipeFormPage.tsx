import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil, Check, ImagePlus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useItems, useCreateRecipe, useEditRecipe, useDeleteRecipe, useRecipe, useRecipeIngredients, useConceptList } from '../api'
import type { Item } from '../api'
import { uploadPhoto } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { MarkdownEditor } from '@/components/MarkdownEditor'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Command, CommandList, CommandItem, CommandEmpty } from '@/components/ui/command'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IngRow {
  key: string
  id?: string
  itemId: string
  itemName: string
  originalItemId: string
  quantity: string
  originalQuantity: string
  section: string
  originalSection: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NO_SECTION = ''

// ── Item combobox ─────────────────────────────────────────────────────────────

function ItemCombobox({
  allItems,
  value,
  onChange,
}: {
  allItems: Item[]
  value: string
  onChange: (item: Item) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = allItems.find(i => i.id === value)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        value={open ? search : (selected?.name ?? '')}
        placeholder="Item"
        className="h-8 text-sm"
        onFocus={() => { setSearch(''); setOpen(true) }}
        onChange={e => { setSearch(e.target.value); if (!open) setOpen(true) }}
      />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command shouldFilter={false}>
            <CommandList>
              {allItems
                .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
                .slice(0, 20)
                .map(item => (
                  <CommandItem
                    key={item.id}
                    onSelect={() => { onChange(item); setOpen(false); setSearch('') }}
                  >
                    {item.name}
                  </CommandItem>
                ))}
              <CommandEmpty>No items found</CommandEmpty>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  )
}

// ── Droppable section container ───────────────────────────────────────────────

function DroppableGroup({
  sectionKey,
  children,
}: {
  sectionKey: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionKey === NO_SECTION ? '__none__' : sectionKey })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-2 rounded transition-colors ${isOver ? 'bg-accent' : 'bg-transparent'}`}
    >
      {children}
    </div>
  )
}

// ── Draggable ingredient row ──────────────────────────────────────────────────

function IngredientRowForm({
  row,
  allItems,
  onUpdate,
  onRemove,
  isDragOverlay = false,
}: {
  row: IngRow
  allItems: Item[]
  onUpdate: (changes: Partial<IngRow>) => void
  onRemove: () => void
  isDragOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.key })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-1 items-start ${isDragging && !isDragOverlay ? 'opacity-30' : 'opacity-100'} ${isDragOverlay ? 'bg-background rounded shadow-md' : ''}`}
    >
      <div
        {...listeners}
        {...attributes}
        className="mt-1 cursor-grab text-muted-foreground touch-none flex items-center"
        style={{ touchAction: 'none' }}
      >
        <GripVertical className="size-4" />
      </div>
      <ItemCombobox
        allItems={allItems}
        value={row.itemId}
        onChange={v => onUpdate({ itemId: v.id, itemName: v.name })}
      />
      <Input
        value={row.quantity}
        onChange={e => onUpdate({ quantity: e.target.value })}
        placeholder="Qty"
        className="w-20 h-8 text-sm"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        className="mt-0.5 text-muted-foreground"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

// ── Section header with inline rename ────────────────────────────────────────

function SectionHeader({
  name,
  onRename,
  onDelete,
}: {
  name: string
  onRename: (newName: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(name)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) onRename(trimmed)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-1 mt-6 mb-2">
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="flex-1 bg-transparent border-b border-input text-xs font-semibold tracking-widest uppercase outline-none"
          />
          <Button variant="ghost" size="icon-xs" onClick={commit}>
            <Check className="size-3" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            {name}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={startEdit} className="text-muted-foreground">
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onDelete} className="text-muted-foreground">
            <Trash2 className="size-3" />
          </Button>
        </>
      )}
    </div>
  )
}

// ── Add section input ─────────────────────────────────────────────────────────

function AddSectionInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue('')
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="mt-2 gap-1"
      >
        <Plus className="size-4" />
        Add section
      </Button>
    )
  }

  return (
    <div className="flex gap-2 mt-2 items-center">
      <Input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setValue(''); setOpen(false) }
        }}
        placeholder="Section name"
        className="flex-1 h-8 text-sm"
        autoFocus
      />
      <Button size="sm" onClick={commit} disabled={!value.trim()}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setValue(''); setOpen(false) }}>
        Cancel
      </Button>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecipeFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  const isEdit = !!id

  const { data: recipeData, isLoading: recipeLoading } = useRecipe(id ?? '')
  const { data: ingredientsData, isLoading: ingredientsLoading } = useRecipeIngredients(id ?? '')

  const { data: allItems = [] } = useItems()

  const { data: recipeTypeConcepts = [] } = useConceptList('recipe-types')
  const typeOptions = useMemo(() =>
    recipeTypeConcepts.map(c => c.name)
  , [recipeTypeConcepts])
  const createRecipe = useCreateRecipe()
  const editRecipe = useEditRecipe(id ?? '')
  const deleteRecipe = useDeleteRecipe(id ?? '')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const isPending = isEdit ? editRecipe.isPending : createRecipe.isPending

  // ── Form state ──────────────────────────────────────────────────────────────

  const [initialized, setInitialized] = useState(false)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)
  const [type, setType] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const [rows, setRows] = useState<IngRow[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [sectionOrder, setSectionOrder] = useState<string[]>([])
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState(false)

  // Initialize form once data is available
  useEffect(() => {
    if (initialized) return

    if (!isEdit) {
      setInitialized(true)
      return
    }

    if (!recipeData || ingredientsLoading) return

    const recipe = recipeData
    const ingredients = ingredientsData ?? []

    setName(recipe.name)
    setType(recipe.type)
    setUrl(recipe.url ?? '')
    setCoverUrl(recipe.coverPhotoUrl ?? '')
    setPreviewUrl(recipe.coverPhotoUrl ?? '')
    setPhotoError(false)
    setInstructions(
      (recipe.blocks ?? [])
        .map(b => {
          switch (b.type) {
            case 'divider':            return '---'
            case 'heading_1':          return `# ${b.text}`
            case 'heading_2':          return `## ${b.text}`
            case 'heading_3':          return `### ${b.text}`
            case 'bulleted_list_item': return `- ${b.text}`
            default:                   return b.text
          }
        })
        .join('\n'),
    )
    const ingRows: IngRow[] = ingredients.map(ing => ({
      key: ing.id,
      id: ing.id,
      itemId: ing.itemId,
      itemName: ing.itemName,
      originalItemId: ing.itemId,
      quantity: ing.quantity ?? '',
      originalQuantity: ing.quantity ?? '',
      section: ing.section ?? '',
      originalSection: ing.section ?? '',
    }))
    setRows(ingRows)
    setRemovedIds([])
    const seen = new Set<string>()
    const order: string[] = []
    for (const ing of ingredients) {
      if (ing.section && !seen.has(ing.section)) {
        seen.add(ing.section)
        order.push(ing.section)
      }
    }
    setSectionOrder(order)
    setNameError(false)
    setInitialized(true)
  }, [isEdit, recipeData, ingredientsData, ingredientsLoading, recipeLoading, initialized])

  // ── DnD sensors ─────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    if (!event.over) return
    const rowKey = event.active.id as string
    const targetSection = event.over.id === '__none__' ? '' : (event.over.id as string)
    setRows(prev => {
      const next = prev.map(r => r.key === rowKey ? { ...r, section: targetSection } : r)
      setSectionOrder(order => order.filter(s => next.some(r => r.section === s)))
      return next
    })
  }

  // ── Row helpers ──────────────────────────────────────────────────────────────

  function addRow(section: string) {
    setRows(prev => [
      ...prev,
      { key: crypto.randomUUID(), itemId: '', itemName: '', originalItemId: '', quantity: '', originalQuantity: '', section, originalSection: section },
    ])
  }

  function removeRow(key: string, rowId?: string) {
    if (rowId) setRemovedIds(prev => [...prev, rowId])
    setRows(prev => {
      const next = prev.filter(r => r.key !== key)
      setSectionOrder(order => order.filter(s => next.some(r => r.section === s)))
      return next
    })
  }

  function updateRow(key: string, changes: Partial<IngRow>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...changes } : r)))
  }

  // ── Section helpers ──────────────────────────────────────────────────────────

  function addSection(sectionName: string) {
    if (!sectionOrder.includes(sectionName)) {
      setSectionOrder(prev => [...prev, sectionName])
    }
  }

  function renameSection(oldName: string, newName: string) {
    if (sectionOrder.includes(newName)) return
    setSectionOrder(prev => prev.map(s => (s === oldName ? newName : s)))
    setRows(prev => prev.map(r => (r.section === oldName ? { ...r, section: newName } : r)))
  }

  function deleteSection(sectionName: string) {
    setSectionOrder(prev => prev.filter(s => s !== sectionName))
    setRows(prev => prev.map(r => (r.section === sectionName ? { ...r, section: '' } : r)))
  }

  // ── Photo upload ─────────────────────────────────────────────────────────────

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const local = URL.createObjectURL(file)
    setPreviewUrl(local)
    setPhotoUploading(true)
    setPhotoError(false)
    try {
      const uploaded = await uploadPhoto(file)
      setCoverUrl(uploaded)
      setPreviewUrl(uploaded)
      URL.revokeObjectURL(local)
    } catch {
      setPhotoError(true)
      setPreviewUrl(coverUrl)
    } finally {
      setPhotoUploading(false)
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const canSubmit = name.trim().length > 0 && !isPending && !photoUploading

  function handleSubmit() {
    if (!name.trim()) {
      setNameError(true)
      return
    }

    setSectionOrder(prev => prev.filter(s => rows.some(r => r.section === s)))

    const recipeBody = {
      name: name.trim(),
      type: type || null,
      url: url.trim() || null,
      coverUrl: coverUrl.trim() || null,
      instructions: instructions.trim(),
    }

    if (isEdit) {
      const newIngredients = rows
        .filter(r => !r.id && r.itemId)
        .map(r => ({ itemId: r.itemId, itemName: r.itemName, quantity: r.quantity || null, section: r.section || null }))
      const updatedIngredients = rows
        .filter(r => !!r.id && (
          r.itemId !== r.originalItemId ||
          r.quantity !== r.originalQuantity ||
          r.section !== r.originalSection
        ))
        .map(r => ({
          id: r.id!,
          itemId: r.itemId !== r.originalItemId ? r.itemId : undefined,
          quantity: r.quantity || null,
          section: r.section || null,
        }))

      editRecipe.mutate(
        { recipe: recipeBody, removedIngredientIds: removedIds, newIngredients, updatedIngredients },
        { onSuccess: () => navigate(-1) },
      )
    } else {
      const ingredients = rows
        .filter(r => r.itemId)
        .map(r => ({ itemId: r.itemId, itemName: r.itemName, quantity: r.quantity || null, section: r.section || null }))

      createRecipe.mutate(
        { recipe: recipeBody, ingredients },
        {
          onSuccess: newRecipe => navigate(`/recipes/${newRecipe.id}`, { replace: true }),
        },
      )
    }
  }

  function handleDelete() {
    deleteRecipe.mutate(undefined, {
      onSuccess: () => navigate('/recipes', { replace: true }),
    })
  }

  // ── Active drag row ──────────────────────────────────────────────────────────

  const activeDragRow = activeDragId ? rows.find(r => r.key === activeDragId) : null

  // ── Loading state for edit mode ──────────────────────────────────────────────

  const isLoadingEdit = isEdit && (recipeLoading || ingredientsLoading || !initialized)

  // ── Ingredient section ───────────────────────────────────────────────────────

  const ingredientSection = (
    <div>
      <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
        Ingredients
      </span>
      <Separator className="mt-1 mb-3" />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <DroppableGroup sectionKey={NO_SECTION}>
          <div className="flex flex-col gap-3">
            {rows.filter(r => r.section === NO_SECTION).map(row => (
              <IngredientRowForm
                key={row.key}
                row={row}
                allItems={allItems}
                onUpdate={changes => updateRow(row.key, changes)}
                onRemove={() => removeRow(row.key, row.id)}
              />
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => addRow(NO_SECTION)} className="mt-2 gap-1">
            <Plus className="size-4" />
            Add ingredient
          </Button>
        </DroppableGroup>

        {sectionOrder.map(sectionName => (
          <div key={sectionName}>
            <SectionHeader
              name={sectionName}
              onRename={newName => renameSection(sectionName, newName)}
              onDelete={() => deleteSection(sectionName)}
            />
            <DroppableGroup sectionKey={sectionName}>
              <div className="flex flex-col gap-3">
                {rows.filter(r => r.section === sectionName).map(row => (
                  <IngredientRowForm
                    key={row.key}
                    row={row}
                    allItems={allItems}
                    onUpdate={changes => updateRow(row.key, changes)}
                    onRemove={() => removeRow(row.key, row.id)}
                  />
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => addRow(sectionName)} className="mt-2 gap-1">
                <Plus className="size-4" />
                Add ingredient
              </Button>
            </DroppableGroup>
          </div>
        ))}

        <DragOverlay>
          {activeDragRow && (
            <IngredientRowForm
              row={activeDragRow}
              allItems={allItems}
              onUpdate={() => {}}
              onRemove={() => {}}
              isDragOverlay
            />
          )}
        </DragOverlay>
      </DndContext>

      <AddSectionInput onAdd={addSection} />
    </div>
  )

  // ── Form body ────────────────────────────────────────────────────────────────

  const typeId = 'recipe-type-list'

  const formBody = (
    <div className="flex flex-col gap-4 pb-4">
      <datalist id={typeId}>
        {typeOptions.map(o => <option key={o} value={o} />)}
      </datalist>

      <div className="flex flex-col gap-1">
        <Input
          value={name}
          onChange={e => { setName(e.target.value); if (nameError) setNameError(false) }}
          placeholder="Name *"
          autoFocus
          aria-invalid={nameError}
          className={nameError ? 'border-destructive' : ''}
        />
        {nameError && (
          <p className="text-xs text-destructive">Name is required</p>
        )}
      </div>

      <Input
        value={type ?? ''}
        onChange={e => setType(e.target.value || null)}
        placeholder="Type"
        list={typeId}
      />

      <Input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://..."
        type="url"
      />

      {/* Cover photo upload */}
      <div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
        {previewUrl ? (
          <div
            className="relative w-full cursor-pointer overflow-hidden rounded"
            style={{ aspectRatio: '16/9' }}
            onClick={() => photoInputRef.current?.click()}
          >
            <img
              src={previewUrl}
              alt="Cover preview"
              className="w-full h-full object-cover block"
            />
            {photoUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
              </div>
            )}
            {!photoUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/35 transition-colors">
                <span className="text-white text-xs opacity-0 pointer-events-none group-hover:opacity-100">
                  Change photo
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => photoInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            style={{ aspectRatio: '16/9' }}
          >
            <ImagePlus className="size-6" />
            <span className="text-xs">Add photo</span>
          </div>
        )}
        {photoError && (
          <p className="text-xs text-destructive mt-1">
            Upload failed — previous photo kept
          </p>
        )}
      </div>

      {ingredientSection}

      <MarkdownEditor
        value={instructions}
        onChange={setInstructions}
        placeholder="One paragraph per line…"
        rows={6}
      />
    </div>
  )

  const title = isEdit ? 'Edit recipe' : 'New recipe'

  return (
    <div className="h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b shrink-0">
        <div className="max-w-xl mx-auto flex items-center px-2 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            disabled={isPending}
            className="-ml-2"
          >
            <ArrowLeft />
          </Button>
          <h1 className="flex-1 text-lg font-bold">{title}</h1>
          <Button disabled={!canSubmit} onClick={handleSubmit} size="sm">
            {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create')}
          </Button>
        </div>
      </header>

      <div className="px-4 py-4 overflow-y-auto overscroll-contain flex-1 max-w-xl mx-auto w-full">
        {isLoadingEdit ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="w-full rounded" style={{ aspectRatio: '16/9' }} />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
            <Skeleton className="h-28 w-full" />
          </div>
        ) : formBody}

        {isEdit && !isLoadingEdit && (
          <div className="mt-6 mb-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isPending || deleteRecipe.isPending}
              className="text-destructive hover:text-destructive gap-1"
            >
              <Trash2 className="size-4" />
              Delete recipe
            </Button>
          </div>
        )}

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Delete recipe?</DialogTitle>
              <DialogDescription>
                This will permanently delete "{name}" and all its ingredients. This can't be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleteRecipe.isPending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteRecipe.isPending}>
                {deleteRecipe.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
