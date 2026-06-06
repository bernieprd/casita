import { useEffect } from 'react'
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
import {
  useGoogleStatus,
  useUserCalendars,
  useUpdateUserCalendars,
  useDisconnectGoogle,
  buildGoogleConnectUrl,
} from '../api/google-calendar'
import type { UserCalendar } from '../api/types'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const oauthResult = searchParams.get('google') // "connected" | "error" | null

  useEffect(() => {
    if (oauthResult) {
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
          onClick={() => { window.location.href = buildGoogleConnectUrl() }}
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
