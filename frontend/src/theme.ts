import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary:    { main: '#2d6a4f' },
    background: { default: '#f5f5f0', paper: '#ffffff' },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: 'none' },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, fontSize: 14 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 0 },
      },
    },
    MuiCheckbox: {
      defaultProps: { disableRipple: true },
    },
  },
})

export default theme
