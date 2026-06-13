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
import {
  useGoogleStatus,
  useUserCalendars,
  useUpdateUserCalendars,
  useDisconnectGoogle,
  initiateGoogleConnect,
} from '../../api/google-calendar'
import type { UserCalendar } from '../../api/types'
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

  // Clear the OAuth query param from the URL after reading it
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
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive mb-2">
              {t('settings.calendar.failedToLoad')}
            </div>
          ) : (
            <>
              {(calendars ?? []).map(cal => (
                <div key={cal.id} className="mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 rounded flex-shrink-0"
                      style={{ backgroundColor: cal.colorHex }}
                      aria-label={t('settings.calendar.calendarColor', { name: cal.name })}
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
                          <SelectItem value="private">{t('settings.calendar.visibilityPrivate')}</SelectItem>
                          <SelectItem value="household">{t('settings.calendar.visibilityHousehold')}</SelectItem>
                          <SelectItem value="free-busy">{t('settings.calendar.visibilityFreeBusy')}</SelectItem>
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
            className="mt-8 text-destructive border-destructive/50 hover:bg-destructive/10 w-full"
            onClick={() => disconnectGoogle()}
          >
            {t('common.disconnect')}
          </Button>
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

          <AlertDialog open={connectGoogleOpen} onOpenChange={setConnectGoogleOpen}>
            <AlertDialogContent>
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
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={() => initiateGoogleConnect()}>
                  {t('common.connect')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
