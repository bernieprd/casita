import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import Switch from '@mui/material/Switch'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import EditIcon from '@mui/icons-material/Edit'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Avatar from '@mui/material/Avatar'
import {
  useGoogleStatus,
  useUserCalendars,
  useUpdateUserCalendars,
  useDisconnectGoogle,
  initiateGoogleConnect,
} from '../api/google-calendar'
import { useHouseholdSettings, useGenerateInvite, useRevokeInvite, useRenameHousehold } from '../api/household'
import { useConceptList, useCreateConcept, useRenameConcept, useDeleteConcept } from '../api/concepts'
import type { ConceptType } from '../api/concepts'
import type { UserCalendar } from '../api/types'
import { useUser } from '@clerk/clerk-react'
import { useAuth } from '../context/AuthContext'

// ── ConceptSection ─────────────────────────────────────────────────────────────

function ConceptSection({ type, label, addLabel }: { type: ConceptType; label: string; addLabel: string }) {
  const { data: concepts = [], isLoading } = useConceptList(type)
  const { mutate: create, isPending: creating } = useCreateConcept(type)
  const { mutate: rename } = useRenameConcept(type)
  const { mutate: remove } = useDeleteConcept(type)

  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  function handleStartAdd() {
    setAddingNew(true)
    setNewName('')
    setTimeout(() => addInputRef.current?.focus(), 0)
  }

  function handleConfirmAdd() {
    const name = newName.trim()
    if (!name) { setAddingNew(false); return }
    create(name, { onSettled: () => { setAddingNew(false); setNewName('') } })
  }

  function handleStartEdit(id: string, name: string) {
    setEditingId(id)
    setEditName(name)
  }

  function handleConfirmEdit(id: string) {
    const name = editName.trim()
    if (name) rename({ id, name })
    setEditingId(null)
  }

  function handleDelete(id: string) {
    setDeleteError(null)
    remove(id, {
      onError: (err: unknown) => {
        const msg = (err as { message?: string })?.message ?? 'Could not delete'
        setDeleteError(msg)
      },
    })
  }

  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        {label}
      </Typography>

      {deleteError && (
        <Alert severity="warning" sx={{ mb: 1, py: 0 }} onClose={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
        {isLoading
          ? [0, 1, 2].map(i => <Skeleton key={i} variant="rounded" width={72} height={28} sx={{ borderRadius: 4 }} />)
          : concepts.map(concept =>
            editingId === concept.id ? (
              <TextField
                key={concept.id}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                size="small"
                autoFocus
                sx={{ width: 120 }}
                inputProps={{ style: { fontSize: 13, padding: '4px 8px' } }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmEdit(concept.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={() => handleConfirmEdit(concept.id)}
              />
            ) : (
              <Chip
                key={concept.id}
                label={concept.name}
                size="small"
                onClick={() => handleStartEdit(concept.id, concept.name)}
                onDelete={() => handleDelete(concept.id)}
                sx={{ cursor: 'pointer' }}
              />
            )
          )
        }

        {addingNew ? (
          <TextField
            inputRef={addInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            size="small"
            placeholder={addLabel}
            sx={{ width: 140 }}
            inputProps={{ style: { fontSize: 13, padding: '4px 8px' } }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirmAdd()
              if (e.key === 'Escape') setAddingNew(false)
            }}
            onBlur={handleConfirmAdd}
            disabled={creating}
          />
        ) : (
          <Button size="small" variant="text" sx={{ fontSize: 12, px: 1, minWidth: 0 }} onClick={handleStartAdd}>
            + {addLabel}
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default function Settings() {
  const { user } = useUser()
  const { logout } = useAuth()
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

      {/* Account section */}
      <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5 }}>
        Account
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Avatar
          src={user?.imageUrl}
          alt={user?.fullName ?? ''}
          sx={{ width: 40, height: 40 }}
        />
        <Box sx={{ minWidth: 0 }}>
          {user?.fullName && (
            <Typography variant="body2" fontWeight={500} noWrap>
              {user.fullName}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.primaryEmailAddress?.emailAddress ?? ''}
          </Typography>
        </Box>
      </Box>

      <Typography
        variant="caption"
        color="text.disabled"
        sx={{ cursor: 'pointer', '&:hover': { color: 'text.secondary' } }}
        onClick={logout}
      >
        Sign out
      </Typography>

      <Divider sx={{ my: 2 }} />

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

      {householdData?.inviteCode ? (
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
          {isOwner && (
            <>
              <Button size="small" variant="outlined" onClick={() => generateInvite()} disabled={generatingInvite}>
                Regenerate
              </Button>
              <Button size="small" color="error" variant="outlined" onClick={() => revokeInvite()} disabled={revokingInvite}>
                Revoke
              </Button>
            </>
          )}
        </Box>
      ) : isOwner ? (
        <Button size="small" variant="outlined" onClick={() => generateInvite()} disabled={generatingInvite}>
          {generatingInvite ? 'Generating…' : 'Generate invite code'}
        </Button>
      ) : null}

      {isOwner && (
        <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5 }}>
            Items
          </Typography>
          <ConceptSection type="categories"   label="Categories"   addLabel="Add category" />
          <ConceptSection type="supermarkets" label="Supermarkets"  addLabel="Add supermarket" />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5 }}>
            Recipes
          </Typography>
          <ConceptSection type="recipe-types" label="Recipe Types" addLabel="Add type" />
          <ConceptSection type="tags"         label="Tags"          addLabel="Add tag" />
        </>
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
