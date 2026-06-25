import { useEffect, type ReactNode } from 'react'
import { useSettingsBack } from '@/hooks/useSettingsBack'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useCommsPreferences, useUpdateCommsPreferences } from '@/api/account'

interface Props {
  setHeader: (node: ReactNode | null) => void
}

export default function NotificationsSettings({ setHeader }: Props) {
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
        <h1 className="flex-1 text-lg font-bold">Notifications</h1>
      </>
    )
    return () => setHeader(null)
  }, [goBack, setHeader])

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
        Email
      </p>

      <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex-1 min-w-0">
            <Label htmlFor="email-notifications" className="text-sm font-medium cursor-pointer">
              Email notifications
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receive welcome emails and household updates
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={prefs?.email_notifications_enabled ?? true}
            onCheckedChange={handleToggle}
            disabled={isLoading || isPending}
          />
        </div>

        {prefs?.email_notifications_enabled === false && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                Email notifications are off. You won't receive any emails from Casita.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
