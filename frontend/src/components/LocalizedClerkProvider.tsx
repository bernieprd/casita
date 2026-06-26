import { useState, useEffect, type ReactNode } from 'react'
import { ClerkProvider } from '@clerk/clerk-react'
import { Capacitor } from '@capacitor/core'
import i18n from '../i18n'
import { normalizeLocale, getClerkLocalization } from '../lib/clerkLocalizations'

// On iOS Capacitor the origin is capacitor://localhost, which Clerk rejects as
// an invalid scheme when resolving relative signInUrl/signUpUrl. We omit those
// props on iOS and use hash-based routing in the SignIn/SignUp components instead.
const isNativeIOS = Capacitor.getPlatform() === 'ios'

export function LocalizedClerkProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(() => normalizeLocale(i18n.language))

  useEffect(() => {
    const handler = (lng: string) => setLocale(normalizeLocale(lng))
    i18n.on('languageChanged', handler)
    return () => { i18n.off('languageChanged', handler) }
  }, [])

  return (
    <ClerkProvider
      key={locale}
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}
      {...(!isNativeIOS && {
        signInUrl: '/sign-in',
        signUpUrl: '/sign-up',
      })}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/household/setup"
      localization={getClerkLocalization(locale)}
    >
      {children}
    </ClerkProvider>
  )
}
