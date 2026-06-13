import React from 'react'
// i18next.t() is used directly (not the hook) because class components can't call hooks.
// A language change while the error boundary is displayed won't re-render this UI.
import i18next from 'i18next'
import { Button } from '@/components/ui/button'

interface State {
  hasError: boolean
  error: Error | null
}

export class TabErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Tab error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="pt-10 text-center px-4">
          <img
            src="/casita.webp"
            alt=""
            className="w-20 mb-2 opacity-50 mx-auto"
          />
          <p className="text-sm font-medium text-muted-foreground mb-0.5">
            {i18next.t('nav.errorTitle')}
          </p>
          <p className="text-sm text-muted-foreground/60 mb-4">
            {this.state.error?.message ?? i18next.t('nav.errorUnexpected')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            {i18next.t('nav.tryAgain')}
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
