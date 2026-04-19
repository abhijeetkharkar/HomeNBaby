import { AppBar, Toolbar, Typography, Box, Chip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ChildCareIcon from '@mui/icons-material/ChildCare';

export function Header() {
  return (
    <AppBar position="static" sx={{ background: 'linear-gradient(135deg, #2e7d8f 0%, #1a5f6e 100%)' }}>
      <Toolbar>
        <HomeIcon sx={{ mr: 0.5, fontSize: 22 }} />
        <ChildCareIcon sx={{ mr: 1.5, fontSize: 22 }} />
        <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
          Home & Baby Tracker
        </Typography>
        <Box display="flex" gap={1}>
          <Chip
            label="Move: Jun 1"
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.7rem' }}
          />
          <Chip
            label="Baby: Jul 13"
            size="small"
            sx={{ bgcolor: 'rgba(194,24,91,0.6)', color: 'white', fontSize: '0.7rem' }}
          />
        </Box>
      </Toolbar>
    </AppBar>
  );
}
