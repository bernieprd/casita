import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import MuiLink from '@mui/material/Link'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function AccountSetup() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const check = await api.post<{ ok: boolean; hasAccount: boolean; error?: string }>(
        '/auth/check', { email }
      )
      if (check.hasAccount) {
        setError('An account already exists for this email. Go to login.')
        return
      }
      if (!check.ok) {
        setError(check.error ?? 'Email not allowed')
        return
      }
      await api.post('/auth/setup', { email, password })
      await auth.login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 360 }}>
        <Typography variant="h5" fontWeight={700} mb={1} textAlign="center" color="text.primary">
          Casita
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
          Set up your account
        </Typography>

        <Stack component="form" onSubmit={handleSubmit} spacing={2}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            fullWidth
            autoComplete="email"
          />
          <TextField
            label="New Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="new-password"
          />
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            fullWidth
            autoComplete="new-password"
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            fullWidth
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {loading ? 'Setting up…' : 'Create account'}
          </Button>

          <MuiLink
            component={RouterLink}
            to="/login"
            underline="hover"
            variant="body2"
            textAlign="center"
            display="block"
          >
            ← Back to login
          </MuiLink>
        </Stack>
      </Box>
    </Box>
  )
}
