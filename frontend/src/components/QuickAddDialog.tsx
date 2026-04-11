import { useState, useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
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
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useItems, useToggleShoppingList, useCreateItem } from '../api'
import type { Item } from '../api'
import { useKeyboardOffset } from '../useKeyboardOffset'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (item: Item) => void
}

export default function QuickAddDialog({ open, onClose, onCreated }: Props) {
  const [query, setQuery] = useState('')
  const { data: allItems = [] } = useItems()
  const toggle = useToggleShoppingList()
  const create = useCreateItem()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const keyboardOffset = useKeyboardOffset()

  const q = query.trim().toLowerCase()

  // All items filtered by query, sorted: not-on-list first, then alphabetical.
  const filtered = useMemo(() => {
    if (!allItems) return []
    return allItems
      .filter(i => !q || i.name.toLowerCase().split(/\s+/).some(word => word.startsWith(q)))
      .sort((a, b) => {
        if (a.onShoppingList !== b.onShoppingList) return a.onShoppingList ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }, [allItems, q])

  const hasExactMatch = filtered.some(i => i.name.toLowerCase().trim() === q)
  const showCreate = q.length > 0 && !hasExactMatch

  function handleToggle(id: string, onShoppingList: boolean) {
    toggle.mutate({ id, onShoppingList: !onShoppingList })
  }

  function handleCreate() {
    create.mutate(
      { name: query.trim(), category: null, supermarkets: [], tags: [], onShoppingList: true },
      { onSuccess: item => { setQuery(''); onClose(); onCreated?.(item) } },
    )
  }

  function handleClose() {
    setQuery('')
    onClose()
  }

  const searchField = (
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
  )

  const itemList = (
    <>
      {filtered.length === 0 && !showCreate && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {q ? 'No items match.' : 'No items found.'}
        </Typography>
      )}

      <List disablePadding dense sx={{ overflow: 'auto', mx: -2 }}>
        {filtered.map((item, idx) => (
          <span key={item.id}>
            {idx > 0 && <Divider component="li" sx={{ ml: 7 }} />}
            <ListItemButton onClick={() => handleToggle(item.id, item.onShoppingList)} sx={{ px: 2 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox
                  edge="start"
                  checked={item.onShoppingList}
                  disableRipple
                  size="small"
                  tabIndex={-1}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    color={item.onShoppingList ? 'text.secondary' : 'text.primary'}
                  >
                    {item.name}
                  </Typography>
                }
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
    </>
  )

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={handleClose}
        ModalProps={{ disableScrollLock: true }}
        PaperProps={{
          sx: {
            borderRadius: '16px 16px 0 0',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            bottom: keyboardOffset,
            transition: 'bottom 150ms ease-out',
          },
        }}
      >
        {/* Drag handle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5, flexShrink: 0 }}>
          <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
        </Box>

        {/* Header */}
        <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            Add to shopping list
          </Typography>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Scrollable content */}
        <Box sx={{ px: 2, pb: 2, overflow: 'auto', flex: 1 }}>
          {searchField}
          {itemList}
        </Box>
      </Drawer>
    )
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
        {searchField}
        <List disablePadding dense sx={{ maxHeight: 360, overflow: 'auto', mx: -2 }}>
          {filtered.map((item, idx) => (
            <span key={item.id}>
              {idx > 0 && <Divider component="li" sx={{ ml: 7 }} />}
              <ListItemButton onClick={() => handleToggle(item.id, item.onShoppingList)} sx={{ px: 2 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={item.onShoppingList}
                    disableRipple
                    size="small"
                    tabIndex={-1}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="body2"
                      color={item.onShoppingList ? 'text.secondary' : 'text.primary'}
                    >
                      {item.name}
                    </Typography>
                  }
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
