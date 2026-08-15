import { useState } from 'react';
import {
  Container,
  Box,
  Tabs,
  Tab,
  Paper,
  useMediaQuery,
  useTheme,
  Typography,
} from '@mui/material';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { DailyLogView } from './components/views/DailyLogView';
import { DashboardView } from './components/views/DashboardView';

import { HeaderStats } from './components/HeaderStats';

type ViewTab = 'Daily' | 'Dashboard';

const TABS: { value: ViewTab; label: string; icon: React.ReactElement }[] = [
  { value: 'Daily', label: 'Daily Log', icon: <FormatListBulletedIcon fontSize="small" /> },
  { value: 'Dashboard', label: 'Dashboard', icon: <AssessmentIcon fontSize="small" /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>('Daily');
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 10 }}>
      {/* Clean Header */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 2, px: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Snigdha 🌸
            </Typography>
            <Box sx={{ display: { xs: 'none', sm: 'flex' } }}>
              <HeaderStats />
            </Box>
          </Box>
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, mt: 1 }}>
            <HeaderStats />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 2, px: { xs: 1, sm: 2, md: 3 } }}>
        <Paper elevation={0} sx={{ mb: 3, overflow: 'hidden', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v: ViewTab) => setActiveTab(v)}
            variant="fullWidth"
            indicatorColor="primary"
            textColor="primary"
            sx={{ minHeight: 48 }}
          >
            {TABS.map(({ value, label, icon }) => (
              <Tab
                key={value}
                value={value}
                label={label}
                icon={icon}
                iconPosition="start"
                sx={{ minHeight: 48, fontSize: '0.9rem', textTransform: 'none', fontWeight: 600 }}
              />
            ))}
          </Tabs>
        </Paper>

        {activeTab === 'Daily' ? <DailyLogView /> : <DashboardView />}
      </Container>
    </Box>
  );
}
