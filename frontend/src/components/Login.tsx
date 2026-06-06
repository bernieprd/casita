import Box from '@mui/material/Box'
import { SignIn } from '@clerk/clerk-react'

export default function Login() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <SignIn routing="hash" />
    </Box>
  )
}
