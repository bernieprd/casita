import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Pencil, Copy, Sun, SunMoon, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { ThemePrefs } from '@/lib/theme'
import { COLOR_PRESETS, FONT_OPTIONS, HEADING_FONT_OPTIONS, DEFAULT_THEME, loadGoogleFont } from '@/lib/theme'
import {
  useHouseholdSettings,
  useGenerateInvite,
  useRevokeInvite,
  useRenameHousehold,
  useLeaveHousehold,
  useTransferOwnership,
  useDeleteHousehold,
  householdThemeKeys,
} from '../../api/household'
import { useUser } from '@clerk/clerk-react'
import { useHousehold } from '../../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { translateError } from '../../lib/errors'

interface Props {
  themePrefs: ThemePrefs
  setThemePrefs: (p: ThemePrefs) => void
  themeSaving: boolean
  setHeader: (node: ReactNode | null) => void
}

export default function HouseholdSettings({ themePrefs, setThemePrefs, themeSaving, setHeader }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()
  const isDark = themePrefs.colorScheme === 'dark' || (themePrefs.colorScheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const { refreshHousehold } = useHousehold()
  const queryClient = useQueryClient()

  const { data: householdData, isLoading: householdLoading } = useHouseholdSettings()
  const isOwner = householdData?.role === 'owner'

  // Rename state
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const { mutate: renameHousehold, isPending: renamePending } = useRenameHousehold()

  // Invite code actions
  const { mutate: generateInvite, isPending: generatingInvite } = useGenerateInvite()
  const { mutate: revokeInvite, isPending: revokingInvite } = useRevokeInvite()

  // Member actions
  const { mutate: transferOwnership, isPending: transferring } = useTransferOwnership()
  const [transferTarget, setTransferTarget] = useState<{ id: string; name: string } | null>(null)

  // Leave / delete household
  const { mutate: leaveHousehold, isPending: leaving } = useLeaveHousehold()
  const { mutate: deleteHousehold, isPending: deletingHousehold } = useDeleteHousehold()
  const [deleteHouseholdOpen, setDeleteHouseholdOpen] = useState(false)

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
          className="-ml-2"
          aria-label={t('common.back')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{t('settings.household.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader, t])

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

  return (
    <div className="p-4">

      {/* Household name */}
      {householdLoading ? (
        <Skeleton className="h-8 w-44 rounded mb-4" />
      ) : renaming ? (
        <div className="flex items-center gap-2 mb-4">
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
            {t('common.save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(false)} disabled={renamePending}>
            {t('common.cancel')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold flex-1">{householdData?.householdName ?? '—'}</h2>
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={handleRenameOpen}
              aria-label={t('settings.household.renameHousehold')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Invite code */}
      {householdData?.inviteCode ? (
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <code className="font-mono text-sm bg-muted px-2 py-1 rounded tracking-widest">
            {householdData.inviteCode}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label={t('settings.household.copyInviteCode')}
            onClick={() =>
              navigator.clipboard
                .writeText(householdData.inviteCode!)
                .catch(() => toast.error(t('settings.household.failedToCopy')))
            }
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {isOwner && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateInvite()}
                disabled={generatingInvite}
              >
                {t('settings.household.regenerate')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={() => revokeInvite()}
                disabled={revokingInvite}
              >
                {t('settings.household.revoke')}
              </Button>
            </>
          )}
        </div>
      ) : isOwner ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateInvite()}
          disabled={generatingInvite}
          className="mb-1"
        >
          {generatingInvite ? t('common.generating') : t('settings.household.generateInviteCode')}
        </Button>
      ) : null}

      {/* Members */}
      {householdData?.members && householdData.members.length > 0 && (
        <div className="mt-3 space-y-2">
          {householdData.members.map(member => (
            <div
              key={member.clerkUserId}
              className="flex items-center gap-2 bg-card border border-border rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.06)] px-3 py-2"
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={member.imageUrl ?? undefined} />
                <AvatarFallback aria-label={`${member.displayName ?? 'Member'} avatar`}>
                  {member.displayName?.[0] ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{member.displayName ?? '—'}</p>
              </div>
              {isOwner && member.clerkUserId !== user?.id && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground h-auto py-0.5 px-1"
                  aria-label={`Make ${member.displayName ?? 'this member'} the household owner`}
                  onClick={() =>
                    setTransferTarget({
                      id: member.clerkUserId,
                      name: member.displayName ?? 'this member',
                    })
                  }
                >
                  {t('settings.household.makeOwner')}
                </Button>
              )}
              <Badge variant="secondary" className="text-xs capitalize">
                {member.role}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!transferTarget}
        onOpenChange={open => { if (!open) setTransferTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.household.transferOwnershipTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.household.transferOwnershipDescription', { name: transferTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={transferring}
              aria-label={t('settings.household.confirmTransfer', { name: transferTarget?.name ?? '' })}
              onClick={() => {
                if (!transferTarget) return
                transferOwnership(transferTarget.id, {
                  onSuccess: () => { setTransferTarget(null); refreshHousehold() },
                  onError: (err: unknown) => toast.error(translateError((err as { message?: string })?.message ?? '', t)),
                })
              }}
            >
              {t('settings.household.transferOwnership')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator className="my-4" />

      <div className="flex flex-col gap-5">

        {/* Color scheme */}
        <div className="flex flex-col gap-3">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('settings.household.colorScheme')}
          </Label>
          <ToggleGroup
            type="single"
            value={themePrefs.colorScheme}
            onValueChange={(value) => {
              if (!value || themeSaving) return
              setThemePrefs({ ...themePrefs, colorScheme: value as ThemePrefs['colorScheme'] })
            }}
            className={cn('justify-start [&_[data-state=on]]:bg-primary [&_[data-state=on]]:text-primary-foreground', themeSaving && 'opacity-50 pointer-events-none')}
          >
            <ToggleGroupItem value="light" aria-label={t('settings.household.light')}>
              <Sun className="h-4 w-4" />
              <span className="ml-1 text-sm">{t('settings.household.light')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="system" aria-label={t('settings.household.system')}>
              <SunMoon className="h-4 w-4" />
              <span className="ml-1 text-sm">{t('settings.household.system')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" aria-label={t('settings.household.dark')}>
              <Moon className="h-4 w-4" />
              <span className="ml-1 text-sm">{t('settings.household.dark')}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('settings.household.color')}
          </Label>
          <div className={themeSaving ? 'opacity-50 pointer-events-none' : ''}>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  title={preset.label}
                  aria-label={preset.label}
                  onClick={() => setThemePrefs({ ...themePrefs, primaryHsl: preset.hsl })}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all',
                    themePrefs.primaryHsl === preset.hsl
                      ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                      : 'hover:scale-105',
                  )}
                  style={{ backgroundColor: `hsl(${isDark ? preset.darkPrimary : preset.lightPrimary})` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('settings.household.headingFont')}
          </Label>
          <div className={themeSaving ? 'opacity-50 pointer-events-none' : ''}>
            <Select
              value={themePrefs.headingFont}
              onValueChange={(value) => {
                const option = HEADING_FONT_OPTIONS.find((o) => o.value === value)
                if (option?.googleFamily) loadGoogleFont(option.googleFamily)
                setThemePrefs({ ...themePrefs, headingFont: value })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEADING_FONT_OPTIONS.map((option) => (
                  <SelectItem key={option.label} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('settings.household.bodyFont')}
          </Label>
          <div className={themeSaving ? 'opacity-50 pointer-events-none' : ''}>
            <Select
              value={themePrefs.bodyFont}
              onValueChange={(value) => {
                const option = FONT_OPTIONS.find((o) => o.value === value)
                if (option?.googleFamily) loadGoogleFont(option.googleFamily)
                setThemePrefs({ ...themePrefs, bodyFont: value })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((option) => (
                  <SelectItem key={option.label} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('settings.household.radius')}
          </Label>
          <div className={themeSaving ? 'opacity-50 pointer-events-none' : ''}>
            <Slider
              min={0}
              max={16}
              step={1}
              value={[Math.round(parseFloat(themePrefs.radius) / 0.0625)]}
              onValueChange={([v]) => {
                const rem = v === 0 ? '0rem' : `${(v * 0.0625).toFixed(3).replace(/\.?0+$/, '')}rem`
                setThemePrefs({ ...themePrefs, radius: rem })
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{t('settings.household.none')}</span>
              <span>{t('settings.household.rounded')}</span>
            </div>
          </div>
        </div>

        <Button variant="outline" onClick={() => setThemePrefs(DEFAULT_THEME)} className="w-full" disabled={themeSaving}>
          {t('settings.household.resetToDefaults')}
        </Button>
      </div>

      <Separator className="my-4" />

      {/* Danger zone */}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {t('settings.household.dangerZone')}
      </p>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        {!isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => leaveHousehold(undefined, { onSuccess: refreshHousehold })}
            disabled={leaving}
          >
            {t('settings.household.leaveHousehold')}
          </Button>
        )}

        {isOwner && (householdData?.members?.length ?? 0) <= 1 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setDeleteHouseholdOpen(true)}
          >
            {t('settings.household.deleteHousehold')}
          </Button>
        )}

        {isOwner && (householdData?.members?.length ?? 0) > 1 && (
          <div className="flex flex-col items-start gap-0.5">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive/40 border-destructive/20 cursor-not-allowed"
              disabled
            >
              {t('settings.household.deleteHousehold')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t('settings.household.transferOwnershipFirst')}
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteHouseholdOpen} onOpenChange={setDeleteHouseholdOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.household.deleteHouseholdTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.household.deleteHouseholdDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingHousehold}
              onClick={(e) => {
                e.preventDefault()
                deleteHousehold(undefined, {
                  onSuccess: () => { setDeleteHouseholdOpen(false); refreshHousehold() },
                  onError: (err: unknown) => toast.error(translateError((err as { message?: string })?.message ?? '', t)),
                })
              }}
            >
              {t('settings.household.deleteHousehold')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
