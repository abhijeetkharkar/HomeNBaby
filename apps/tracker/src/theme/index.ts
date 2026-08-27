import { createTheme } from '@mui/material/styles';

export const getHeaderGradient = (gender: 'girl' | 'boy' | 'mixed' | null) => {
  if (gender === 'girl') return 'linear-gradient(135deg, #d4788c 0%, #e895a6 50%, #d4788c 100%)';
  if (gender === 'boy') return 'linear-gradient(135deg, #5B8CB9 0%, #7CA8CC 50%, #5B8CB9 100%)';
  return 'linear-gradient(135deg, #d4788c 0%, #5B8CB9 50%, #d4788c 100%)';
};

export const getTheme = (gender: 'girl' | 'boy' | 'mixed') => createTheme({
  palette: {
    primary: {
      main: gender === 'girl' ? '#d4788c' : gender === 'boy' ? '#5B8CB9' : '#a358c2',
    },
    secondary: {
      main: gender === 'girl' ? '#7c6bc4' : gender === 'boy' ? '#7CA8CC' : '#5B8CB9',
    },
    background: {
      default: '#faf7f5',
    },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: '8px !important',
          '&:before': { display: 'none' },
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
        containedPrimary: gender === 'mixed' ? {
          background: 'linear-gradient(135deg, #d4788c 0%, #5B8CB9 100%)',
          color: 'white',
        } : undefined,
      },
    },
  },
});
