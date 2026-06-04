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
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await auth.login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const noAccount = error?.includes('No account')

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
        <Typography variant="h5" fontWeight={700} mb={3} textAlign="center" color="text.primary">
          Casita
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
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            fullWidth
            autoComplete="current-password"
          />

          {error && (
            <Alert severity="error">
              {error}
              {noAccount && (
                <>
                  {' '}
                  <MuiLink component={RouterLink} to="/setup" underline="always">
                    Set up your account →
                  </MuiLink>
                </>
              )}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            fullWidth
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
