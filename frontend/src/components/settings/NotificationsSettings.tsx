import { useEffect, type ReactNode } from 'react'
import { useSettingsBack } from '@/hooks/useSettingsBack'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from 'react-i18next'
import { useCommsPreferences, useUpdateCommsPreferences } from '@/api/account'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

export default function NotificationsSettings({ setHeader }: Props) {
  const { t } = useTranslation()
  const goBack = useSettingsBack()
  const { data: prefs, isLoading } = useCommsPreferences()
  const { mutate: updatePrefs, isPending } = useUpdateCommsPreferences()

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="-ml-2"
          aria-label="Back"
        >
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold">{t('settings.notifications.title')}</h1>
      </>
    )
    return () => setHeader(null)
  }, [goBack, setHeader, t])

  function handleToggle(enabled: boolean) {
    if (!prefs) return
    updatePrefs(
      { email_notifications_enabled: enabled, email_frequency: enabled ? 'instant' : 'off' },
      { onError: () => toast.error('Failed to save preferences') },
    )
  }

  return (
    <div className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {t('settings.notifications.emailSection')}
      </p>

      <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex-1 min-w-0">
            <Label htmlFor="email-notifications" className="text-sm font-medium cursor-pointer">
              {t('settings.notifications.toggleLabel')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('settings.notifications.toggleDescription')}
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={prefs?.email_notifications_enabled ?? false}
            onCheckedChange={handleToggle}
            disabled={isLoading || isPending}
          />
        </div>

        {prefs?.email_notifications_enabled === false && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {t('settings.notifications.offMessage')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
