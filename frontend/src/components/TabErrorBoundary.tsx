import React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

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
        <Box sx={{ pt: 10, textAlign: 'center', px: 4 }}>
          <Box
            component="img"
            src="/casita.png"
            alt=""
            sx={{ width: 80, mb: 2, opacity: 0.5 }}
          />
          <Typography variant="body1" fontWeight={500} color="text.secondary" sx={{ mb: 0.5 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
            {this.state.error?.message ?? 'Unexpected error'}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </Button>
        </Box>
      )
    }
    return this.props.children
  }
}
