import { useState, useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
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
import { useItems, useRecipes, useCreateRecipe, useEditRecipe } from '../api'
import type { Item, RecipeWithBlocks, RecipeIngredient } from '../api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface IngRow {
  key: string
  id?: string            // existing ingredient id — undefined means new row
  itemId: string
  itemName: string
  originalItemId: string
  quantity: string
  originalQuantity: string
  section: string        // '' = no section
  originalSection: string
}

interface Props {
  open: boolean
  /** Omit for create mode */
  recipeId?: string
  /** Omit for create mode */
  initialData?: {
    recipe: RecipeWithBlocks
    ingredients: RecipeIngredient[]
  }
  onClose: () => void
  /** Called with the new recipe id in create mode, undefined in edit mode */
  onSaved: (newId?: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TYPE_OPTIONS = ['Favourite', 'Try again', 'New']
const NO_SECTION = ''   // sentinel for the "unsectioned" bucket

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
    <Box
      ref={setNodeRef}
      sx={{
        minHeight: 8,
        borderRadius: 1,
        transition: 'background 150ms',
        bgcolor: isOver ? 'action.hover' : 'transparent',
      }}
    >
      {children}
    </Box>
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
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        gap: 0.5,
        alignItems: 'flex-start',
        opacity: isDragging && !isDragOverlay ? 0.3 : 1,
        bgcolor: isDragOverlay ? 'background.paper' : 'transparent',
        borderRadius: isDragOverlay ? 1 : 0,
        boxShadow: isDragOverlay ? 3 : 0,
      }}
    >
      <Box
        {...listeners}
        {...attributes}
        sx={{
          mt: 0.75,
          cursor: 'grab',
          color: 'text.disabled',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Autocomplete
        sx={{ flex: 1 }}
        options={allItems ?? []}
        getOptionLabel={opt => (typeof opt === 'string' ? opt : opt.name)}
        value={allItems?.find(i => i.id === row.itemId) ?? null}
        onChange={(_, v) => {
          if (v && typeof v !== 'string') {
            onUpdate({ itemId: v.id, itemName: v.name })
          }
        }}
        slotProps={{ popper: { placement: 'top-start' } }}
        renderInput={params => <TextField {...params} label="Item" size="small" />}
        isOptionEqualToValue={(opt, val) => opt.id === val.id}
        noOptionsText="No items found"
      />
      <TextField
        label="Qty"
        size="small"
        value={row.quantity}
        onChange={e => onUpdate({ quantity: e.target.value })}
        sx={{ width: 80 }}
      />
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{ mt: 0.5, color: 'text.secondary' }}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Box>
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, mb: 0.5 }}>
      {editing ? (
        <>
          <TextField
            inputRef={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            size="small"
            variant="standard"
            sx={{ flex: 1 }}
            inputProps={{ style: { fontWeight: 600, fontSize: '0.75rem', letterSpacing: '.08em', textTransform: 'uppercase' } }}
          />
          <IconButton size="small" onClick={commit}>
            <CheckIcon fontSize="small" />
          </IconButton>
        </>
      ) : (
        <>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: '.08em', flex: 1 }}
          >
            {name}
          </Typography>
          <IconButton size="small" onClick={startEdit} sx={{ color: 'text.disabled' }}>
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" onClick={onDelete} sx={{ color: 'text.disabled' }}>
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </>
      )}
    </Box>
  )
}

// ── Add section dialog ────────────────────────────────────────────────────────

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
        startIcon={<AddIcon />}
        size="small"
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        sx={{ mt: 1 }}
      >
        Add section
      </Button>
    )
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
      <TextField
        inputRef={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setValue(''); setOpen(false) }
        }}
        size="small"
        placeholder="Section name"
        sx={{ flex: 1 }}
        autoFocus
      />
      <Button size="small" variant="contained" onClick={commit} disabled={!value.trim()}>
        Add
      </Button>
      <Button size="small" onClick={() => { setValue(''); setOpen(false) }}>
        Cancel
      </Button>
    </Box>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecipeFormSheet({ open, recipeId, initialData, onClose, onSaved }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const isEdit = !!recipeId && !!initialData

  const { data: allItems = [] } = useItems()

  const { data: recipes } = useRecipes()
  const typeOptions = useMemo(() => {
    const fromDb = (recipes ?? []).map(r => r.type).filter(Boolean) as string[]
    return [...new Set([...TYPE_OPTIONS, ...fromDb])].sort()
  }, [recipes])
  const dayOptions = useMemo(() => {
    const fromDb = (recipes ?? []).map(r => r.day).filter(Boolean) as string[]
    return [...new Set([...DAY_OPTIONS, ...fromDb])].sort()
  }, [recipes])

  const createRecipe = useCreateRecipe()
  const editRecipe = useEditRecipe(recipeId ?? '')
  const isPending = isEdit ? editRecipe.isPending : createRecipe.isPending

  // ── Form state ──────────────────────────────────────────────────────────────

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)
  const [type, setType] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const [rows, setRows] = useState<IngRow[]>([])
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [sectionOrder, setSectionOrder] = useState<string[]>([]) // named sections only
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (isEdit && initialData) {
      const { recipe, ingredients } = initialData
      setName(recipe.name)
      setType(recipe.type)
      setDay(recipe.day)
      setUrl(recipe.url ?? '')
      setCoverUrl(recipe.coverPhotoUrl ?? '')
      setInstructions(
        (recipe.blocks ?? [])
          .map(b => (b.type === 'divider' ? '---' : b.text))
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
      // Build section order from first-appearance of named sections
      const seen = new Set<string>()
      const order: string[] = []
      for (const ing of ingredients) {
        if (ing.section && !seen.has(ing.section)) {
          seen.add(ing.section)
          order.push(ing.section)
        }
      }
      setSectionOrder(order)
    } else {
      setName('')
      setType(null)
      setDay(null)
      setUrl('')
      setCoverUrl('')
      setInstructions('')
      setRows([])
      setRemovedIds([])
      setSectionOrder([])
    }

    setNameError(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

  function removeRow(key: string, id?: string) {
    if (id) setRemovedIds(prev => [...prev, id])
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

  function addSection(name: string) {
    if (!sectionOrder.includes(name)) {
      setSectionOrder(prev => [...prev, name])
    }
  }

  function renameSection(oldName: string, newName: string) {
    if (sectionOrder.includes(newName)) return
    setSectionOrder(prev => prev.map(s => (s === oldName ? newName : s)))
    setRows(prev => prev.map(r => (r.section === oldName ? { ...r, section: newName } : r)))
  }

  function deleteSection(name: string) {
    setSectionOrder(prev => prev.filter(s => s !== name))
    // Move rows in that section back to no-section
    setRows(prev => prev.map(r => (r.section === name ? { ...r, section: '' } : r)))
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const canSubmit = name.trim().length > 0 && !isPending

  function handleSubmit() {
    if (!name.trim()) {
      setNameError(true)
      return
    }

    // Drop sections that never got any ingredients
    setSectionOrder(prev => prev.filter(s => rows.some(r => r.section === s)))

    const recipeBody = {
      name: name.trim(),
      type: type || null,
      day: day || null,
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
        {
          onSuccess: () => {
            onSaved(undefined)
            onClose()
          },
        },
      )
    } else {
      const ingredients = rows
        .filter(r => r.itemId)
        .map(r => ({ itemId: r.itemId, itemName: r.itemName, quantity: r.quantity || null, section: r.section || null }))

      createRecipe.mutate(
        { recipe: recipeBody, ingredients },
        {
          onSuccess: newRecipe => {
            onSaved(newRecipe.id)
            onClose()
          },
        },
      )
    }
  }

  // ── Active drag row ──────────────────────────────────────────────────────────

  const activeDragRow = activeDragId ? rows.find(r => r.key === activeDragId) : null

  // ── Ingredient section ───────────────────────────────────────────────────────

  const ingredientSection = (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '.08em' }}>
        Ingredients
      </Typography>
      <Divider sx={{ mt: 0.5, mb: 1.5 }} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Unsectioned rows */}
        <DroppableGroup sectionKey={NO_SECTION}>
          <Stack spacing={1.5}>
            {rows.filter(r => r.section === NO_SECTION).map(row => (
              <IngredientRowForm
                key={row.key}
                row={row}
                allItems={allItems}
                onUpdate={changes => updateRow(row.key, changes)}
                onRemove={() => removeRow(row.key, row.id)}
              />
            ))}
          </Stack>
          <Button startIcon={<AddIcon />} size="small" onClick={() => addRow(NO_SECTION)} sx={{ mt: 1 }}>
            Add ingredient
          </Button>
        </DroppableGroup>

        {/* Named sections */}
        {sectionOrder.map(sectionName => (
          <Box key={sectionName}>
            <SectionHeader
              name={sectionName}
              onRename={newName => renameSection(sectionName, newName)}
              onDelete={() => deleteSection(sectionName)}
            />
            <DroppableGroup sectionKey={sectionName}>
              <Stack spacing={1.5}>
                {rows.filter(r => r.section === sectionName).map(row => (
                  <IngredientRowForm
                    key={row.key}
                    row={row}
                    allItems={allItems}
                    onUpdate={changes => updateRow(row.key, changes)}
                    onRemove={() => removeRow(row.key, row.id)}
                  />
                ))}
              </Stack>
              <Button startIcon={<AddIcon />} size="small" onClick={() => addRow(sectionName)} sx={{ mt: 1 }}>
                Add ingredient
              </Button>
            </DroppableGroup>
          </Box>
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
    </Box>
  )

  // ── Form body ────────────────────────────────────────────────────────────────

  const formBody = (
    <Stack spacing={2} sx={{ pb: 2 }}>
      <TextField
        label="Name"
        fullWidth
        value={name}
        onChange={e => { setName(e.target.value); if (nameError) setNameError(false) }}
        size="small"
        required
        error={nameError}
        helperText={nameError ? 'Name is required' : undefined}
        autoFocus
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Autocomplete
          freeSolo
          options={typeOptions}
          value={type ?? ''}
          onChange={(_, v) => setType(v || null)}
          onInputChange={(_, v, reason) => { if (reason === 'input') setType(v || null) }}
          slotProps={{ popper: { placement: 'top-start' } }}
          renderInput={params => <TextField {...params} label="Type" size="small" />}
        />
        <Autocomplete
          freeSolo
          options={dayOptions}
          value={day ?? ''}
          onChange={(_, v) => setDay(v || null)}
          onInputChange={(_, v, reason) => { if (reason === 'input') setDay(v || null) }}
          slotProps={{ popper: { placement: 'top-start' } }}
          renderInput={params => <TextField {...params} label="Day" size="small" />}
        />
      </Box>

      <TextField
        label="URL"
        fullWidth
        value={url}
        onChange={e => setUrl(e.target.value)}
        size="small"
        type="url"
        placeholder="https://..."
      />

      <Box>
        <TextField
          label="Cover photo URL"
          fullWidth
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          size="small"
          type="url"
          placeholder="https://..."
        />
        {coverUrl && (
          <Box
            component="img"
            src={coverUrl}
            alt="Cover preview"
            sx={{ mt: 1, width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 1, display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
      </Box>

      <TextField
        label="Instructions"
        fullWidth
        multiline
        minRows={4}
        value={instructions}
        onChange={e => setInstructions(e.target.value)}
        size="small"
        placeholder="One paragraph per line…"
      />

      {ingredientSection}
    </Stack>
  )

  const title = isEdit ? 'Edit recipe' : 'New recipe'

  const actions = (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, width: '100%' }}>
      <Button onClick={onClose} color="inherit" disabled={isPending}>
        Cancel
      </Button>
      <Button variant="contained" disabled={!canSubmit} onClick={handleSubmit}>
        {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create')}
      </Button>
    </Box>
  )

  // ── Mobile full-screen ───────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <Dialog open={open} onClose={isPending ? undefined : onClose} fullScreen>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ px: 2 }}>
            <IconButton edge="start" size="small" onClick={onClose} disabled={isPending} sx={{ mr: 1 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1, fontSize: '1rem', fontWeight: 600 }}>
              {title}
            </Typography>
            <Button variant="contained" disableElevation disabled={!canSubmit} onClick={handleSubmit} size="small">
              {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save' : 'Create')}
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ px: 2, py: 2, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {formBody}
        </Box>
      </Dialog>
    )
  }

  // ── Desktop dialog ───────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <Box
        sx={{
          px: 3,
          pt: 2.5,
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} disabled={isPending}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent sx={{ pt: 1 }}>
        {formBody}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {actions}
      </DialogActions>
    </Dialog>
  )
}
