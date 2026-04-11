import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Typography from '@mui/material/Typography'
import MergeTypeIcon from '@mui/icons-material/MergeType'
import { useMergeItems } from '../api'
import type { Item } from '../api'
import { useKeyboardOffset } from '../useKeyboardOffset'

interface Props {
  open: boolean
  groups: Item[][]
  onClose: () => void
}

export default function MergeDuplicatesSheet({ open, groups, onClose }: Props) {
  // Which item to keep per group index
  const [keepers, setKeepers] = useState<Record<number, string>>({})
  const [merging, setMerging] = useState(false)
  const mergeItems = useMergeItems()
  const keyboardOffset = useKeyboardOffset()

  useEffect(() => {
    if (open) {
      setKeepers(Object.fromEntries(groups.map((g, i) => [i, g[0].id])))
    }
  }, [open, groups])

  async function handleMergeAll() {
    setMerging(true)
    try {
      for (let i = 0; i < groups.length; i++) {
        const keepId = keepers[i] ?? groups[i][0].id
        const discards = groups[i].filter(item => item.id !== keepId)
        for (const discard of discards) {
          await mergeItems.mutateAsync({ discardId: discard.id, keepId })
        }
      }
      onClose()
    } finally {
      setMerging(false)
    }
  }

  const totalDuplicates = groups.reduce((sum, g) => sum + g.length - 1, 0)

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={merging ? undefined : onClose}
      ModalProps={{ disableScrollLock: true }}
      PaperProps={{ sx: { borderRadius: '16px 16px 0 0', maxHeight: Math.min(window.innerHeight * 0.80, window.innerHeight - keyboardOffset - 8), display: 'flex', flexDirection: 'column', bgcolor: 'background.paper', bottom: keyboardOffset, transition: 'bottom 150ms ease-out' } }}
    >
      {/* Handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5, flexShrink: 0 }}>
        <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      {/* Header */}
      <Box sx={{ px: 3, pt: 0.5, pb: 1.5, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
          Duplicate items
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {groups.length === 1
            ? `"${groups[0][0].name}" appears ${groups[0].length} times`
            : `${groups.length} names appear more than once`}
          . Pick which to keep — recipe links update automatically.
        </Typography>
      </Box>

      <Divider />

      {/* Groups */}
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        {groups.map((group, i) => (
          <Box key={group[0].name + i} sx={{ px: 3, py: 2 }}>
            {i > 0 && <Divider sx={{ mb: 2, mx: -3 }} />}
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
              {group[0].name}
            </Typography>
            <RadioGroup
              value={keepers[i] ?? group[0].id}
              onChange={(_, val) => setKeepers(prev => ({ ...prev, [i]: val }))}
            >
              {group.map(item => (
                <FormControlLabel
                  key={item.id}
                  value={item.id}
                  disabled={merging}
                  control={<Radio size="small" />}
                  label={
                    <Box sx={{ py: 0.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {item.category && (
                          <Chip label={item.category} size="small" variant="outlined" sx={{ fontSize: 11, height: 20 }} />
                        )}
                        {item.supermarkets.map(s => (
                          <Chip key={s} label={s} size="small" sx={{ fontSize: 11, height: 20, bgcolor: 'action.hover' }} />
                        ))}
                        {!item.category && item.supermarkets.length === 0 && (
                          <Typography variant="caption" color="text.disabled">No details</Typography>
                        )}
                      </Box>
                    </Box>
                  }
                  sx={{ mt: 0.5 }}
                />
              ))}
            </RadioGroup>
          </Box>
        ))}
      </Box>

      <Divider />

      {/* Actions */}
      <Box sx={{ px: 3, pt: 1.5, pb: 3, flexShrink: 0 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleMergeAll}
          disabled={merging}
          startIcon={merging ? <CircularProgress size={16} color="inherit" /> : <MergeTypeIcon />}
        >
          {merging ? 'Merging…' : `Remove ${totalDuplicates} duplicate${totalDuplicates !== 1 ? 's' : ''}`}
        </Button>
        <Button fullWidth color="inherit" onClick={onClose} disabled={merging} sx={{ mt: 0.5 }}>
          Cancel
        </Button>
      </Box>
    </Drawer>
  )
}
