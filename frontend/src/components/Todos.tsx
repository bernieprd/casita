import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export default function Todos() {
  return (
    <Box sx={{ py: 4, textAlign: 'center' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Todos
      </Typography>
      <Typography color="text.secondary">Coming soon.</Typography>
    </Box>
  )
}
