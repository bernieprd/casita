import { useState, useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import TextField from '@mui/material/TextField'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import CloseIcon from '@mui/icons-material/Close'
import { useItems, useToggleShoppingList, useCreateItem } from '../api'

interface Props {
  open: boolean
  onClose: () => void
}

export default function QuickAddDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const { data: allItems } = useItems()
  const toggle = useToggleShoppingList()
  const create = useCreateItem()

  const q = query.trim().toLowerCase()

  // Only show items not already on the shopping list, filtered by query.
  const filtered = useMemo(() => {
    if (!allItems) return []
    return allItems
      .filter(i => !i.onShoppingList && (!q || i.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allItems, q])

  const hasExactMatch = filtered.some(i => i.name.toLowerCase() === q)
  const showCreate = q.length > 0 && !hasExactMatch

  function handleAdd(id: string) {
    toggle.mutate({ id, onShoppingList: true })
    // Keep dialog open — user often adds multiple items at once.
  }

  function handleCreate() {
    create.mutate({
      name: query.trim(),
      category: null,
      supermarkets: [],
      tags: [],
      onShoppingList: true,
    })
    setQuery('')
  }

  function handleClose() {
    setQuery('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        Add to shopping list
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0, px: 2, pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Search inventory…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="disabled" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setQuery('')}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{ mb: 1 }}
        />

        {filtered.length === 0 && !showCreate && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            {q ? 'No items match.' : 'All items are on your list.'}
          </Typography>
        )}

        <List disablePadding dense sx={{ maxHeight: 360, overflow: 'auto', mx: -2 }}>
          {filtered.map((item, idx) => (
            <span key={item.id}>
              {idx > 0 && <Divider component="li" sx={{ ml: 7 }} />}
              <ListItemButton onClick={() => handleAdd(item.id)} sx={{ px: 3 }}>
                <ListItemText
                  primary={item.name}
                  secondary={item.category}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            </span>
          ))}

          {showCreate && (
            <>
              {filtered.length > 0 && <Divider />}
              <ListItemButton onClick={handleCreate} sx={{ px: 3 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <AddCircleOutlineIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body2">
                      Create{' '}
                      <Typography component="span" variant="body2" fontWeight={600}>
                        "{query.trim()}"
                      </Typography>
                    </Typography>
                  }
                  secondary="New item · added to shopping list"
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            </>
          )}
        </List>
      </DialogContent>
    </Dialog>
  )
}
