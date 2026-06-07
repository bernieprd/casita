import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Switch from '@mui/material/Switch'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import EditIcon from '@mui/icons-material/Edit'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  useGoogleStatus,
  useUserCalendars,
  useUpdateUserCalendars,
  useDisconnectGoogle,
  initiateGoogleConnect,
} from '../api/google-calendar'
import { useHouseholdSettings, useGenerateInvite, useRevokeInvite, useRenameHousehold } from '../api/household'
import type { UserCalendar } from '../api/types'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const oauthResult = searchParams.get('google') // "connected" | "error" | null

  useEffect(() => {
    if (oauthResult) {
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Household ──────────────────────────────────────────────────────────────

  const { data: householdData, isLoading: householdLoading } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const { mutate: generateInvite, isPending: generatingInvite } = useGenerateInvite()
  const { mutate: revokeInvite, isPending: revokingInvite } = useRevokeInvite()
  const { mutate: renameHousehold, isPending: renamePending } = useRenameHousehold()

  function handleRenameOpen() {
    setNameInput(householdData?.householdName ?? '')
    setRenaming(true)
  }

  function handleRenameSave() {
    if (!nameInput.trim()) return
    renameHousehold(nameInput.trim(), { onSuccess: () => setRenaming(false) })
  }

  // ── Google Calendar ────────────────────────────────────────────────────────

  const { data: googleStatus, isLoading: statusLoading } = useGoogleStatus()
  const isConnected = googleStatus?.connected ?? false

  const { data: calendarData, isLoading: calendarsLoading, isError: calendarsError } = useUserCalendars()
  const calendars = calendarData?.calendars
  const { mutate: updateCalendars } = useUpdateUserCalendars()
  const { mutate: disconnectGoogle } = useDisconnectGoogle()

  function handleToggle(cal: UserCalendar) {
    if (!calendars) return
    const updated = calendars.map(c =>
      c.id === cal.id ? { ...c, enabled: !c.enabled } : c
    )
    updateCalendars(updated)
  }

  function handleVisibility(cal: UserCalendar, visibility: UserCalendar['visibility']) {
    if (!calendars) return
    const updated = calendars.map(c =>
      c.id === cal.id ? { ...c, visibility } : c
    )
    updateCalendars(updated)
  }

  return (
    <Box sx={{ p: 2 }}>

      {/* OAuth result alert */}
      {oauthResult === 'connected' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Google Calendar connected successfully.
        </Alert>
      )}
      {oauthResult === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to connect Google Calendar. Please try again.
        </Alert>
      )}

      {/* Household section */}
      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
        Household
      </Typography>

      {householdLoading ? (
        <Skeleton width={180} height={28} sx={{ borderRadius: 1, mb: 1 }} />
      ) : renaming ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <TextField
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            size="small"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameSave()
              if (e.key === 'Escape') setRenaming(false)
            }}
            sx={{ flex: 1 }}
          />
          <Button size="small" variant="contained" onClick={handleRenameSave} disabled={renamePending}>
            Save
          </Button>
          <Button size="small" onClick={() => setRenaming(false)} disabled={renamePending}>
            Cancel
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="body2">{householdData?.householdName ?? '—'}</Typography>
          {isOwner && (
            <IconButton size="small" onClick={handleRenameOpen}>
              <EditIcon fontSize="inherit" />
            </IconButton>
          )}
        </Box>
      )}

      {isOwner && (
        householdData?.inviteCode ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box
              sx={{
                fontFamily: 'monospace',
                fontSize: 14,
                bgcolor: 'action.hover',
                px: 1,
                py: 0.5,
                borderRadius: 1,
                letterSpacing: '0.1em',
              }}
            >
              {householdData.inviteCode}
            </Box>
            <IconButton
              size="small"
              onClick={() => navigator.clipboard.writeText(householdData.inviteCode!)}
              title="Copy code"
            >
              <ContentCopyIcon fontSize="inherit" />
            </IconButton>
            <Button size="small" variant="outlined" onClick={() => generateInvite()} disabled={generatingInvite}>
              Regenerate
            </Button>
            <Button size="small" color="error" variant="outlined" onClick={() => revokeInvite()} disabled={revokingInvite}>
              Revoke
            </Button>
          </Box>
        ) : (
          <Button size="small" variant="outlined" onClick={() => generateInvite()} disabled={generatingInvite}>
            {generatingInvite ? 'Generating…' : 'Generate invite code'}
          </Button>
        )
      )}

      <Divider sx={{ my: 2 }} />

      {/* Google Account section */}
      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
        Google Account
      </Typography>

      {statusLoading ? (
        <Skeleton width={220} height={36} sx={{ borderRadius: 1 }} />
      ) : isConnected ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2">Google Calendar connected</Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => disconnectGoogle()}
          >
            Disconnect
          </Button>
        </Box>
      ) : (
        <Button
          variant="outlined"
          size="small"
          onClick={() => initiateGoogleConnect()}
        >
          Connect Google Calendar
        </Button>
      )}

      {/* My Calendars section */}
      {isConnected && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
            My Calendars
          </Typography>

          {calendarsLoading ? (
            <>
              {[0, 1, 2].map(i => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Skeleton variant="rectangular" width={16} height={16} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                  <Skeleton width={140} height={20} sx={{ flex: 1 }} />
                  <Skeleton variant="rectangular" width={44} height={24} sx={{ borderRadius: 1 }} />
                </Box>
              ))}
            </>
          ) : calendarsError ? (
            <Alert severity="error">Failed to load calendars. Try reconnecting.</Alert>
          ) : (
            <>
              {(calendars ?? []).map(cal => (
                <Box key={cal.id} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: 0.5,
                        bgcolor: cal.colorHex,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {cal.name}
                    </Typography>
                    <Switch
                      checked={cal.enabled}
                      size="small"
                      onChange={() => handleToggle(cal)}
                    />
                  </Box>

                  {cal.enabled && (
                    <Box sx={{ pl: 3.5, mt: 0.5 }}>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={cal.visibility ?? 'private'}
                          onChange={e => handleVisibility(cal, e.target.value as UserCalendar['visibility'])}
                          sx={{ fontSize: 13 }}
                        >
                          <MenuItem value="private">Private — only me</MenuItem>
                          <MenuItem value="household">Household — full events</MenuItem>
                          <MenuItem value="free-busy">Household — free/busy only</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                </Box>
              ))}
            </>
          )}
        </>
      )}
    </Box>
  )
}
