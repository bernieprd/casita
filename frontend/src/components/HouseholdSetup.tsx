import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function HouseholdSetup() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<0 | 1>(0)

  // Create flow state
  const [householdName, setHouseholdName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Join flow state
  const [inviteCode, setInviteCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreateLoading(true)
    try {
      await api.post<{ id: string; name: string }>('/household', { name: householdName.trim() })
      navigate('/', { replace: true })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create household')
    } finally {
      setCreateLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError(null)
    setJoinLoading(true)
    try {
      await api.post<{ id: string; name: string }>('/household/join', { inviteCode: inviteCode.trim() })
      navigate('/', { replace: true })
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join household')
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 400 }}>
        <Typography variant="h5" fontWeight={700} mb={1} textAlign="center" color="text.primary">
          Welcome to Casita
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
          Set up your household to get started
        </Typography>

        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, overflow: 'hidden' }}>
          <Tabs
            value={tab}
            onChange={(_, v: 0 | 1) => setTab(v)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Create household" />
            <Tab label="Join with code" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {tab === 0 && (
              <Stack component="form" onSubmit={handleCreate} spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Start a new household and invite your housemates.
                </Typography>
                <TextField
                  label="Household name"
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  required
                  fullWidth
                  autoFocus
                  placeholder="e.g. The Smith House"
                />
                {createError && <Alert severity="error">{createError}</Alert>}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={createLoading || !householdName.trim()}
                  fullWidth
                  size="large"
                  startIcon={createLoading ? <CircularProgress size={18} color="inherit" /> : null}
                >
                  {createLoading ? 'Creating…' : 'Create household'}
                </Button>
              </Stack>
            )}

            {tab === 1 && (
              <Stack component="form" onSubmit={handleJoin} spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Enter the invite code shared by a housemate.
                </Typography>
                <TextField
                  label="Invite code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  required
                  fullWidth
                  autoFocus
                  placeholder="e.g. ABC-123"
                  inputProps={{ style: { textTransform: 'uppercase', letterSpacing: 2 } }}
                />
                {joinError && <Alert severity="error">{joinError}</Alert>}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={joinLoading || !inviteCode.trim()}
                  fullWidth
                  size="large"
                  startIcon={joinLoading ? <CircularProgress size={18} color="inherit" /> : null}
                >
                  {joinLoading ? 'Joining…' : 'Join household'}
                </Button>
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
