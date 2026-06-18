import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  useGoogleStatus,
  useUserCalendars,
  useUpdateUserCalendars,
  useDisconnectGoogle,
  initiateGoogleConnect,
} from '../../api/google-calendar'
import type { UserCalendar, ConnectedAccount } from '../../api/types'
import { useTranslation } from 'react-i18next'

interface CalendarSettingsProps {
  setHeader: (node: ReactNode | null) => void
}

export default function CalendarSettings({ setHeader }: CalendarSettingsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const oauthResult = searchParams.get('google')

  const [connectGoogleOpen, setConnectGoogleOpen] = useState(false)
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectedAccount | null>(null)

  useEffect(() => {
    if (oauthResult) {
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => location.key === 'default' ? navigate('/settings') : navigate(-1)}
          className="-ml-2"
          aria-label={t('common.back')}
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{t('settings.calendar.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [navigate, setHeader, t])

  const { data: statusData, isLoading: statusLoading } = useGoogleStatus()
  const accounts = statusData?.accounts ?? []
  const isConnected = accounts.length > 0

  const { data: calendarData, isLoading: calendarsLoading, isError: calendarsError } = useUserCalendars()
  const calendars = calendarData?.calendars ?? []
  const { mutate: updateCalendars } = useUpdateUserCalendars()
  const { mutate: disconnectGoogle, isPending: isDisconnecting } = useDisconnectGoogle()

  function handleToggle(cal: UserCalendar) {
    const updated = calendars.map(c =>
      c.id === cal.id && c.accountEmail === cal.accountEmail ? { ...c, enabled: !c.enabled } : c
    )
    updateCalendars(updated)
  }

  function handleVisibility(cal: UserCalendar, visibility: UserCalendar['visibility']) {
    const updated = calendars.map(c =>
      c.id === cal.id && c.accountEmail === cal.accountEmail ? { ...c, visibility } : c
    )
    updateCalendars(updated)
  }

  function handleDisconnect() {
    if (!disconnectTarget) return
    disconnectGoogle(disconnectTarget.accountEmail, {
      onSettled: () => setDisconnectTarget(null),
    })
  }

  return (
    <div className="p-4">

      {/* OAuth result banners */}
      {oauthResult === 'connected' && (
        <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          {t('settings.calendar.connectSuccess')}
        </div>
      )}
      {oauthResult === 'error' && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('settings.calendar.connectError')}
        </div>
      )}

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
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
              {t('settings.calendar.failedToLoad')}
            </div>
          ) : (
            <>
              {accounts.map((account, i) => {
                const accountCalendars = calendars.filter(c => c.accountEmail === account.accountEmail)
                return (
                  <div key={account.accountEmail}>
                    {i > 0 && <Separator className="my-5" />}

                    {/* Account header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium">{t('settings.calendar.googleCalendar')}</p>
                        <p className="text-xs text-muted-foreground">{account.accountEmail}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7"
                        onClick={() => setDisconnectTarget(account)}
                      >
                        {t('common.disconnect')}
                      </Button>
                    </div>

                    {/* Calendars for this account */}
                    {accountCalendars.map(cal => (
                      <div key={cal.id} className="mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded flex-shrink-0"
                            style={{ backgroundColor: cal.colorHex }}
                            aria-label={t('settings.calendar.calendarColor', { name: cal.name })}
                          />
                          <span className="text-sm flex-1 truncate">{cal.name}</span>
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
                                <SelectItem value="private">{t('settings.calendar.visibilityPrivate')}</SelectItem>
                                <SelectItem value="household">{t('settings.calendar.visibilityHousehold')}</SelectItem>
                                <SelectItem value="free-busy">{t('settings.calendar.visibilityFreeBusy')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}

          {/* Add another account */}
          <div className="mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConnectGoogleOpen(true)}
            >
              {t('settings.calendar.addGoogleAccount')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConnectGoogleOpen(true)}
          >
            {t('settings.calendar.connectGoogleCalendar')}
          </Button>
        </>
      )}

      {/* Connect dialog */}
      <AlertDialog open={connectGoogleOpen} onOpenChange={setConnectGoogleOpen}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.calendar.connectDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.calendar.connectDialogDescription')}{' '}
              <a
                href="https://mycasita.app/privacy"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Privacy policy
              </a>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => initiateGoogleConnect()}>
              {t('common.connect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect confirmation */}
      <AlertDialog open={disconnectTarget !== null} onOpenChange={open => !open && setDisconnectTarget(null)}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.calendar.disconnectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.calendar.disconnectDescription', { email: disconnectTarget?.accountEmail ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel disabled={isDisconnecting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? t('common.disconnect') + '…' : t('common.disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
