import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import type { Item } from '../api'
import { useKeyboardOffset } from '../useKeyboardOffset'

interface Props {
  open: boolean
  items: Item[]
  onClose: () => void
  onEdit: (item: Item) => void
}

export default function IncompleteItemsSheet({ open, items, onClose, onEdit }: Props) {
  const keyboardOffset = useKeyboardOffset()

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{ disableScrollLock: true }}
      PaperProps={{
        sx: {
          borderRadius: '16px 16px 0 0',
          maxHeight: Math.min(window.innerHeight * 0.80, window.innerHeight - keyboardOffset - 8),
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          bottom: keyboardOffset,
          transition: 'bottom 150ms ease-out',
        },
      }}
    >
      {/* Handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5, flexShrink: 0 }}>
        <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      {/* Header */}
      <Box sx={{ px: 3, pt: 0.5, pb: 1.5, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Items missing info
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tap an item to add its category or supermarket.
        </Typography>
      </Box>

      <Divider />

      {/* List */}
      <Box sx={{ overflow: 'auto', flex: 1, overscrollBehavior: 'contain' }}>
        <List disablePadding>
          {items.map((item, idx) => (
            <span key={item.id}>
              {idx > 0 && <Divider component="li" sx={{ ml: 2 }} />}
              <ListItemButton
                sx={{ px: 3, py: 1.25 }}
                onClick={() => { onEdit(item); onClose() }}
              >
                <ListItemText
                  primary={item.name}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      {item.category === null && (
                        <Chip label="No category" size="small" color="warning" variant="outlined"
                          sx={{ fontSize: 11, height: 20 }} />
                      )}
                      {item.supermarkets.length === 0 && (
                        <Chip label="No supermarket" size="small" color="warning" variant="outlined"
                          sx={{ fontSize: 11, height: 20 }} />
                      )}
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'span' }}
                />
              </ListItemButton>
            </span>
          ))}
        </List>
      </Box>

      <Divider />

      {/* Actions */}
      <Box sx={{ px: 3, pt: 1.5, pb: 3, flexShrink: 0 }}>
        <Button fullWidth color="inherit" onClick={onClose}>
          Close
        </Button>
      </Box>
    </Drawer>
  )
}
