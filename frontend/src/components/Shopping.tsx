import { useState, useMemo } from 'react'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Paper from '@mui/material/Paper'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import SearchIcon from '@mui/icons-material/Search'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import ShoppingList from './ShoppingList'
import Items from './Items'
import ItemFormDialog from './ItemFormDialog'
import { useItems, useToggleShoppingList, useCreateItem } from '../api'
import type { Item } from '../api'

type SubTab = 'list' | 'inventory'

export default function Shopping() {
  const [sub, setSub] = useState<SubTab>('list')
  const [query, setQuery] = useState('')
  const [editItem, setEditItem] = useState<Item | null>(null)

  const { data: allItems = [] } = useItems()
  const toggle = useToggleShoppingList()
  const create = useCreateItem()

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return []
    return allItems
      .filter(i => i.name.toLowerCase().split(/\s+/).some(word => word.startsWith(q)))
      .sort((a, b) => {
        if (a.onShoppingList !== b.onShoppingList) return a.onShoppingList ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }, [allItems, q])

  const hasExactMatch = filtered.some(i => i.name.toLowerCase().trim() === q)
  const showCreate = q.length > 0 && !hasExactMatch

  function handleToggle(item: Item) {
    toggle.mutate({ id: item.id, onShoppingList: !item.onShoppingList })
  }

  function handleCreate() {
    create.mutate(
      { name: query.trim(), category: null, supermarkets: [], tags: [], onShoppingList: true },
      { onSuccess: item => { setQuery(''); setEditItem(item) } },
    )
  }

  return (
    <Box>
      {/* Search bar — matches Recipes / Todos sticky bar pattern */}
      <ClickAwayListener onClickAway={() => setQuery('')}>
        <Box
          sx={{
            position: 'sticky',
            top: { xs: '57px', sm: '65px' },
            ml: 'calc(50% - 50vw)',
            width: '100vw',
            mt: -2,
            zIndex: 10,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, py: 1.5, position: 'relative' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search inventory…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            {q && (
              <Paper
                elevation={4}
                sx={{
                  position: 'absolute',
                  top: '100%',
                  left: 16,
                  right: 16,
                  zIndex: 10,
                  // dvh responds to viewport changes automatically (including keyboard on mobile)
                  // offset = header(57) + searchbar(64) + gap(4) + bottom-nav(~68) + margin(16) ≈ 210px
                  maxHeight: 'calc(100dvh - 210px - env(safe-area-inset-bottom))',
                  overflowY: 'auto',
                  mt: 0.5,
                }}
              >
                {filtered.length === 0 && !showCreate && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No items match.
                  </Typography>
                )}

                <List disablePadding dense>
                  {filtered.map((item, idx) => (
                    <span key={item.id}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        disablePadding
                        secondaryAction={
                          <Button
                            size="small"
                            disableElevation
                            variant={item.onShoppingList ? 'outlined' : 'contained'}
                            color={item.onShoppingList ? 'inherit' : 'primary'}
                            onClick={e => { e.stopPropagation(); handleToggle(item) }}
                            sx={{ textTransform: 'none', minWidth: 68, mr: 0.5 }}
                          >
                            {item.onShoppingList ? 'Remove' : 'Add'}
                          </Button>
                        }
                      >
                        <ListItemButton onClick={() => handleToggle(item)} sx={{ pr: 10 }}>
                          <ListItemText
                            primary={
                              <Typography variant="body2" color={item.onShoppingList ? 'text.secondary' : 'text.primary'}>
                                {item.name}
                              </Typography>
                            }
                            secondary={item.category ?? undefined}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    </span>
                  ))}

                  {showCreate && (
                    <>
                      {filtered.length > 0 && <Divider />}
                      <ListItemButton onClick={handleCreate}>
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
              </Paper>
            )}
          </Box>
        </Box>
      </ClickAwayListener>

      <Tabs
        value={sub}
        onChange={(_, v: SubTab) => setSub(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Shopping list" value="list" />
        <Tab label="Inventory" value="inventory" />
      </Tabs>
      {sub === 'list'      && <ShoppingList />}
      {sub === 'inventory' && <Items />}

      <ItemFormDialog
        open={editItem !== null}
        item={editItem}
        onClose={() => setEditItem(null)}
      />
    </Box>
  )
}
