import { Download, Share, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function InstallBanner() {
  const { showBanner, isIOS, dismiss, triggerInstall } = useInstallPrompt()

  if (!showBanner) return null

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 text-primary text-sm border-b border-primary/20">
      {isIOS ? (
        <>
          <Share className="size-4 shrink-0" />
          <span className="flex-1">
            Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong>
          </span>
        </>
      ) : (
        <>
          <Download className="size-4 shrink-0" />
          <span className="flex-1">Install Casita for quick access</span>
          <button onClick={triggerInstall} className="font-semibold underline shrink-0">
            Install
          </button>
        </>
      )}
      <button onClick={dismiss} aria-label="Dismiss install banner" className="shrink-0 ml-1">
        <X className="size-4" />
      </button>
    </div>
  )
}
