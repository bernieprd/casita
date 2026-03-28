import { useState, useEffect, useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { useItems, useCreateItem, useUpdateItem } from '../api'
import type { Item } from '../api'

interface Props {
  open: boolean
  item?: Item | null   // null/undefined = create mode
  onClose: () => void
}

export default function ItemFormDialog({ open, item, onClose }: Props) {
  const { data: allItems } = useItems()
  const create = useCreateItem()
  const update = useUpdateItem()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [supermarkets, setSupermarkets] = useState<string[]>([])

  // Reset form whenever the dialog opens or the target item changes.
  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setCategory(item?.category ?? null)
      setSupermarkets(item?.supermarkets ?? [])
    }
  }, [open, item])

  // Derive option lists from the cached inventory.
  const categoryOptions = useMemo(() =>
    [...new Set(allItems?.map(i => i.category).filter((c): c is string => !!c))].sort()
  , [allItems])

  const supermarketOptions = useMemo(() =>
    [...new Set(allItems?.flatMap(i => i.supermarkets))].sort()
  , [allItems])

  const isEdit = !!item
  const isPending = create.isPending || update.isPending
  const canSubmit = name.trim().length > 0 && !isPending

  function handleSubmit() {
    const data = { name: name.trim(), category, supermarkets, tags: [], onShoppingList: item?.onShoppingList ?? false }
    if (isEdit) {
      update.mutate({ id: item.id, data }, { onSuccess: onClose })
    } else {
      create.mutate(data, { onSuccess: onClose })
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isEdit ? 'Edit item' : 'New item'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSubmit && handleSubmit()}
            size="small"
          />

          <Autocomplete
            freeSolo
            options={categoryOptions}
            value={category}
            onChange={(_, v) => setCategory(v)}
            onInputChange={(_, v, reason) => {
              if (reason === 'input') setCategory(v || null)
            }}
            renderInput={params => (
              <TextField {...params} label="Category" size="small" />
            )}
          />

          <Autocomplete
            multiple
            freeSolo
            options={supermarketOptions}
            value={supermarkets}
            onChange={(_, v) => setSupermarkets(v as string[])}
            renderInput={params => (
              <TextField {...params} label="Supermarkets" size="small" />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
