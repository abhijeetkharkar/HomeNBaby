import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#2e7d8f',
    },
    secondary: {
      main: '#c2185b',
    },
    background: {
      default: '#f0f4f8',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: '8px !important',
          '&:before': { display: 'none' },
        },
      },
    },
  },
});
