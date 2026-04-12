import { useState, useEffect, useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useItems, useCreateItem, useUpdateItem } from '../api'
import type { Item } from '../api'
import { useKeyboardOffset } from '../useKeyboardOffset'

interface Props {
  open: boolean
  item?: Item | null   // null/undefined = create mode
  onClose: () => void
  onDeleteRequest?: () => void  // called when user taps Delete in edit mode
}

export default function ItemFormDialog({ open, item, onClose, onDeleteRequest }: Props) {
  const { data: allItems = [] } = useItems()
  const create = useCreateItem()
  const update = useUpdateItem()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const keyboardOffset = useKeyboardOffset()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [supermarkets, setSupermarkets] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '')
      setCategory(item?.category ?? null)
      setSupermarkets(item?.supermarkets ?? [])
    }
  }, [open, item])

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

  const formContent = (
    <Stack spacing={2}>
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
        slotProps={{ popper: { placement: 'top-start' } }}
        renderInput={params => (
          <TextField {...params} label="Category" size="small" />
        )}
      />
      <Autocomplete
        multiple
        freeSolo
        disableCloseOnSelect
        options={supermarketOptions}
        value={supermarkets}
        onChange={(_, v) => setSupermarkets(v as string[])}
        slotProps={{ popper: { placement: 'top-start' } }}
        renderInput={params => (
          <TextField {...params} label="Supermarkets" size="small" />
        )}
      />
    </Stack>
  )

  const actions = (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      {isEdit && onDeleteRequest
        ? <Button color="error" onClick={onDeleteRequest}>Delete</Button>
        : <span />
      }
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button variant="contained" disabled={!canSubmit} onClick={handleSubmit}>
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </Box>
    </Box>
  )

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        ModalProps={{ disableScrollLock: true }}
        PaperProps={{
          sx: {
            borderRadius: '16px 16px 0 0',
            maxHeight: Math.min(window.innerHeight * 0.90, window.innerHeight - keyboardOffset - 8),
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            bottom: keyboardOffset,
            transition: 'bottom 150ms ease-out',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
        </Box>
        <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            {isEdit ? 'Edit item' : 'New item'}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ px: 2, pb: 1, overflow: 'auto', flex: 1, overscrollBehavior: 'contain' }}>
          {formContent}
        </Box>
        <Box sx={{ px: 2, py: 2, flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}>
          {actions}
        </Box>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isEdit ? 'Edit item' : 'New item'}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 0.5 }}>
          {formContent}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {actions}
      </DialogActions>
    </Dialog>
  )
}
