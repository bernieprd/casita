import { Download, Share, X } from 'lucide-react'
import { useTranslation, Trans } from 'react-i18next'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function InstallBanner() {
  const { t } = useTranslation()
  const { showBanner, isIOS, dismiss, triggerInstall } = useInstallPrompt()

  if (!showBanner) return null

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 text-primary text-sm border-b border-primary/20">
      {isIOS ? (
        <>
          <Share className="size-4 shrink-0" />
          <span className="flex-1">
            <Trans i18nKey="nav.installIOS" components={{ bold: <strong /> }} />
          </span>
        </>
      ) : (
        <>
          <Download className="size-4 shrink-0" />
          <span className="flex-1">{t('nav.installAndroid')}</span>
          <button onClick={triggerInstall} className="font-semibold underline shrink-0">
            {t('nav.install')}
          </button>
        </>
      )}
      <button onClick={dismiss} aria-label={t('nav.dismissInstall')} className="shrink-0 ml-1">
        <X className="size-4" />
      </button>
    </div>
  )
}
