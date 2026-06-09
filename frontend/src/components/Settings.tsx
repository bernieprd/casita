import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Pencil, Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ThemeCustomizer } from './ThemeCustomizer'
import type { ThemePrefs } from '@/lib/theme'
import {
  useGoogleStatus,
  useUserCalendars,
  useUpdateUserCalendars,
  useDisconnectGoogle,
  initiateGoogleConnect,
} from '../api/google-calendar'
import { useHouseholdSettings, useGenerateInvite, useRevokeInvite, useRenameHousehold, useLeaveHousehold, householdThemeKeys } from '../api/household'
import { useConceptList, useCreateConcept, useRenameConcept, useDeleteConcept, useBackfillConcepts } from '../api/concepts'
import type { ConceptType } from '../api/concepts'
import type { UserCalendar } from '../api/types'
import { useUser } from '@clerk/clerk-react'
import { useAuth, useHousehold } from '../context/AuthContext'

// ── ConceptSection ─────────────────────────────────────────────────────────────

function ConceptSection({ type, label, addLabel }: { type: ConceptType; label: string; addLabel: string }) {
  const { data: concepts = [], isLoading, isError } = useConceptList(type)
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
    <div className="mb-4">
      <p className="text-sm font-semibold mb-2">{label}</p>

      {deleteError && (
        <div className="flex items-center gap-2 mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="flex-1">{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="text-amber-600 hover:text-amber-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        {isLoading
          ? [0, 1, 2].map(i => <Skeleton key={i} className="h-6 w-16 rounded-full" />)
          : isError
          ? <span className="text-xs text-destructive">Could not load — check your connection</span>
          : concepts.map(concept =>
            editingId === concept.id ? (
              <Input
                key={concept.id}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                autoFocus
                className="w-28 h-6 text-xs px-2 py-0"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleConfirmEdit(concept.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={() => handleConfirmEdit(concept.id)}
              />
            ) : (
              <Badge
                key={concept.id}
                variant="secondary"
                className="cursor-pointer gap-1 pr-1"
                onClick={() => handleStartEdit(concept.id, concept.name)}
              >
                {concept.name}
                <button
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  onClick={e => { e.stopPropagation(); handleDelete(concept.id) }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          )
        }

        {addingNew ? (
          <Input
            ref={addInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={addLabel}
            className="w-36 h-6 text-xs px-2 py-0"
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirmAdd()
              if (e.key === 'Escape') setAddingNew(false)
            }}
            onBlur={handleConfirmAdd}
            disabled={creating}
          />
        ) : (
          <button
            className="text-xs text-muted-foreground hover:text-foreground px-1"
            onClick={handleStartAdd}
          >
            + {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}


interface SettingsProps {
  themePrefs: ThemePrefs
  setThemePrefs: (prefs: ThemePrefs) => void
  themeSaving: boolean
}

export default function Settings({ themePrefs, setThemePrefs, themeSaving }: SettingsProps) {

  const { user } = useUser()
  const { logout } = useAuth()
  const { refreshHousehold } = useHousehold()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const oauthResult = searchParams.get('google')

  const { mutate: backfill } = useBackfillConcepts()
  const backfillRan = useRef(false)
  useEffect(() => {
    if (backfillRan.current) return
    backfillRan.current = true
    backfill()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (oauthResult) {
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Household ──────────────────────────────────────────────────────────────

  const { data: householdData, isLoading: householdLoading } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

  // ── Theme customizer ───────────────────────────────────────────────────────
  const [themeOpen, setThemeOpen] = useState(false)

  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const { mutate: generateInvite, isPending: generatingInvite } = useGenerateInvite()
  const { mutate: revokeInvite, isPending: revokingInvite } = useRevokeInvite()
  const { mutate: renameHousehold, isPending: renamePending } = useRenameHousehold()
  const { mutate: leaveHousehold, isPending: leaving } = useLeaveHousehold()

  function handleRenameOpen() {
    setNameInput(householdData?.householdName ?? '')
    setRenaming(true)
  }

  function handleRenameSave() {
    if (!nameInput.trim()) return
    renameHousehold(nameInput.trim(), {
      onSuccess: () => {
        setRenaming(false)
        refreshHousehold()
        queryClient.invalidateQueries({ queryKey: householdThemeKeys.theme })
      },
    })
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
    <div className="p-4">

      {/* OAuth result banners */}
      {oauthResult === 'connected' && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          Google Calendar connected successfully.
        </div>
      )}
      {oauthResult === 'error' && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Failed to connect Google Calendar. Please try again.
        </div>
      )}

      {/* Account section */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Account
      </p>

      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? ''} />
          <AvatarFallback>{user?.fullName?.[0] ?? '?'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {user?.fullName && (
            <p className="text-sm font-medium truncate">{user.fullName}</p>
          )}
          <p className="text-xs text-muted-foreground truncate">
            {user?.primaryEmailAddress?.emailAddress ?? ''}
          </p>
        </div>
      </div>

      <button
        className="text-xs text-muted-foreground/60 hover:text-muted-foreground cursor-pointer"
        onClick={logout}
      >
        Sign out
      </button>

      <Separator className="my-4" />

      {/* Appearance section */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Appearance
      </p>

      <ThemeCustomizer prefs={themePrefs} setPrefs={setThemePrefs} open={themeOpen} onOpenChange={setThemeOpen} isPending={themeSaving} />
      <Button variant="outline" size="sm" className="mb-1" onClick={() => setThemeOpen(true)}>
        Customize theme
      </Button>

      <Separator className="my-4" />

      {/* Household section */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Household
      </p>

      {householdLoading ? (
        <Skeleton className="h-7 w-44 rounded mb-2" />
      ) : renaming ? (
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            autoFocus
            className="flex-1 h-8 text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter') handleRenameSave()
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
          <Button size="sm" onClick={handleRenameSave} disabled={renamePending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(false)} disabled={renamePending}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 mb-2">
          <span className="text-sm">{householdData?.householdName ?? '—'}</span>
          {isOwner && (
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleRenameOpen}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {householdData?.inviteCode ? (
        <div className="flex items-center gap-2 flex-wrap">
          <code className="font-mono text-sm bg-muted px-2 py-1 rounded tracking-widest">
            {householdData.inviteCode}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Copy code"
            onClick={() => navigator.clipboard.writeText(householdData.inviteCode!).catch(() => toast.error('Failed to copy'))}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {isOwner && (
            <>
              <Button size="sm" variant="outline" onClick={() => generateInvite()} disabled={generatingInvite}>
                Regenerate
              </Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => revokeInvite()} disabled={revokingInvite}>
                Revoke
              </Button>
            </>
          )}
        </div>
      ) : isOwner ? (
        <Button size="sm" variant="outline" onClick={() => generateInvite()} disabled={generatingInvite}>
          {generatingInvite ? 'Generating…' : 'Generate invite code'}
        </Button>
      ) : null}

      {/* Members */}
      {householdData?.members && householdData.members.length > 0 && (
        <div className="mt-3 space-y-2">
          {householdData.members.map(member => (
            <div key={member.clerkUserId} className="flex items-center gap-2">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={member.imageUrl ?? undefined} />
                <AvatarFallback>{member.displayName?.[0] ?? '?'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{member.displayName ?? member.email ?? '—'}</p>
                {member.displayName && member.email && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
              </div>
              <Badge variant="secondary" className="text-xs capitalize">{member.role}</Badge>
            </div>
          ))}
        </div>
      )}

      {!isOwner && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 text-destructive border-destructive/50 hover:bg-destructive/10"
          onClick={() => leaveHousehold(undefined, { onSuccess: refreshHousehold })}
          disabled={leaving}
        >
          Leave household
        </Button>
      )}

      <Separator className="my-4" />

      {/* Google Calendar section */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Google Calendar
      </p>

      {statusLoading ? (
        <Skeleton className="h-9 w-56 rounded" />
      ) : isConnected ? (
        <>
          {calendarsLoading ? (
            <>
              {[0, 1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 mb-2">
                  <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-11 rounded" />
                </div>
              ))}
            </>
          ) : calendarsError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive mb-2">
              Failed to load calendars. Try reconnecting.
            </div>
          ) : (
            <>
              {(calendars ?? []).map(cal => (
                <div key={cal.id} className="mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 rounded flex-shrink-0"
                      style={{ backgroundColor: cal.colorHex }}
                    />
                    <span className="text-sm flex-1">{cal.name}</span>
                    <Switch
                      checked={cal.enabled}
                      onCheckedChange={() => handleToggle(cal)}
                    />
                  </div>

                  {cal.enabled && (
                    <div className="pl-7 mt-1.5">
                      <Select
                        value={cal.visibility ?? 'private'}
                        onValueChange={val => handleVisibility(cal, val as UserCalendar['visibility'])}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">Private — only me</SelectItem>
                          <SelectItem value="household">Household — full events</SelectItem>
                          <SelectItem value="free-busy">Household — free/busy only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-1 text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => disconnectGoogle()}
          >
            Disconnect
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => initiateGoogleConnect()}
        >
          Connect Google Calendar
        </Button>
      )}

      {isOwner && (
        <>
          <Separator className="my-4" />

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Shopping
          </p>
          <ConceptSection type="categories"   label="Categories"   addLabel="Add category" />
          <ConceptSection type="supermarkets" label="Supermarkets"  addLabel="Add supermarket" />

          <Separator className="my-4" />

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Recipes
          </p>
          <ConceptSection type="recipe-types" label="Type" addLabel="Add type" />
        </>
      )}
    </div>
  )
}
