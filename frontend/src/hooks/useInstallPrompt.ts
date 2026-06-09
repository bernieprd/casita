import { useEffect, useRef, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UseInstallPromptReturn {
  showBanner: boolean
  isIOS: boolean
  dismiss: () => void
  triggerInstall: () => Promise<void>
}

const DISMISSED_KEY = 'casita-install-dismissed'
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
}

function isDismissedRecently(): boolean {
  const stored = localStorage.getItem(DISMISSED_KEY)
  if (!stored) return false
  return Date.now() - new Date(stored).getTime() < COOLDOWN_MS
}

export function useInstallPrompt(): UseInstallPromptReturn {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const isIOS = isIOSSafari()

  useEffect(() => {
    if (isStandalone() || isDismissedRecently()) return

    if (isIOS) {
      setShowBanner(true)
      return
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setShowBanner(true)
    }

    const handleAppInstalled = () => {
      setShowBanner(false)
      deferredPrompt.current = null
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isIOS])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString())
    setShowBanner(false)
  }

  const triggerInstall = async () => {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    deferredPrompt.current = null
  }

  return { showBanner, isIOS, dismiss, triggerInstall }
}
