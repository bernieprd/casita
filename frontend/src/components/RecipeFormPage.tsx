import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
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
import { useItems, useRecipes, useCreateRecipe, useEditRecipe, useDeleteRecipe, useRecipe, useRecipeIngredients, useConceptList } from '../api'
import type { Item } from '../api'
import { uploadPhoto } from '../api/client'

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

const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const NO_SECTION = ''

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
  const { data: recipes } = useRecipes()
  const dayOptions = useMemo(() => {
    const fromDb = (recipes ?? []).map(r => r.day).filter(Boolean) as string[]
    return [...new Set([...DAY_OPTIONS, ...fromDb])].sort()
  }, [recipes])

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
  const [day, setDay] = useState<string | null>(null)
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
    setDay(recipe.day)
    setUrl(recipe.url ?? '')
    setCoverUrl(recipe.coverPhotoUrl ?? '')
    setPreviewUrl(recipe.coverPhotoUrl ?? '')
    setPhotoError(false)
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
  }, [isEdit, recipeData, ingredientsData, ingredientsLoading, initialized])

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
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '.08em' }}>
        Ingredients
      </Typography>
      <Divider sx={{ mt: 0.5, mb: 1.5 }} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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

      {/* Cover photo upload */}
      <Box>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhotoChange}
        />
        {previewUrl ? (
          <Box
            sx={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 1, overflow: 'hidden', cursor: 'pointer' }}
            onClick={() => photoInputRef.current?.click()}
          >
            <Box
              component="img"
              src={previewUrl}
              alt="Cover preview"
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {photoUploading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.4)' }}>
                <CircularProgress size={32} sx={{ color: 'white' }} />
              </Box>
            )}
            {!photoUploading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0)', '&:hover': { bgcolor: 'rgba(0,0,0,0.35)' }, transition: 'background 0.15s' }}>
                <Typography variant="caption" sx={{ color: 'white', opacity: 0, '.MuiBox-root:hover > &': { opacity: 1 }, pointerEvents: 'none' }}>
                  Change photo
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Box
            onClick={() => photoInputRef.current?.click()}
            sx={{ width: '100%', aspectRatio: '16/9', border: '2px dashed', borderColor: 'divider', borderRadius: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5, cursor: 'pointer', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
          >
            <AddPhotoAlternateIcon />
            <Typography variant="caption">Add photo</Typography>
          </Box>
        )}
        {photoError && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
            Upload failed — previous photo kept
          </Typography>
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

  return (
    <Box sx={{ height: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ px: 2 }}>
          <IconButton edge="start" size="small" onClick={() => navigate(-1)} disabled={isPending} sx={{ mr: 1 }}>
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

      <Box sx={{ px: 2, py: 2, overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, maxWidth: 600, mx: 'auto', width: '100%' }}>
        {isLoadingEdit ? (
          <Stack spacing={2}>
            <Skeleton height={40} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Skeleton height={40} />
              <Skeleton height={40} />
            </Box>
            <Skeleton height={40} />
            <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '16/9', borderRadius: 1 }} />
            <Skeleton height={120} />
          </Stack>
        ) : formBody}

        {isEdit && !isLoadingEdit && (
          <Box sx={{ mt: 3, mb: 2, display: 'flex', justifyContent: 'center' }}>
            <Button
              color="error"
              size="small"
              startIcon={<DeleteOutlineIcon fontSize="small" />}
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isPending || deleteRecipe.isPending}
            >
              Delete recipe
            </Button>
          </Box>
        )}

        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle>Delete recipe?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This will permanently delete "{name}" and all its ingredients. This can't be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteRecipe.isPending}>
              Cancel
            </Button>
            <Button color="error" onClick={handleDelete} disabled={deleteRecipe.isPending}>
              {deleteRecipe.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  )
}
