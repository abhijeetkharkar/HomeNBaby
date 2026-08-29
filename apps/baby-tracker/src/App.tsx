import { useState } from 'react';
import {
  Container,
  Box,
  Tabs,
  Tab,
  Paper,
  useMediaQuery,
  Typography,
  ThemeProvider,
  CssBaseline,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Alert
} from '@mui/material';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { DailyLogView } from './components/views/DailyLogView';
import { DashboardView } from './components/views/DashboardView';
import { OnboardingView } from './components/views/OnboardingView';
import { HeaderStats } from './components/HeaderStats';
import { Authenticator } from '@aws-amplify/ui-react';
import { useBabyProfile, BabyProfileProvider } from './hooks/useBabyProfile';
import { getTheme, getHeaderGradient } from './theme';

type ViewTab = 'Daily' | 'Dashboard';

const TABS: { value: ViewTab; label: string; icon: React.ReactElement }[] = [
  { value: 'Daily', label: 'Daily Log', icon: <FormatListBulletedIcon fontSize="small" /> },
  { value: 'Dashboard', label: 'Dashboard', icon: <AssessmentIcon fontSize="small" /> },
];

const HeartIcon = ({ gender }: { gender: 'girl' | 'boy' }) => {
  const isGirl = gender === 'girl';
  const fill = isGirl ? '#f3aebf' : '#64b5f6'; // lighter than #d4788c / #2196f3
  const stroke = isGirl ? '#9c4b5e' : '#0d47a1'; // darker
  
  return (
    <svg 
      viewBox="0 0 24 24" 
      style={{ 
        width: '1em', 
        height: '1em'
      }}
    >
      <path 
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
        fill={fill} 
        stroke={stroke} 
        strokeWidth="1.5"
      />
    </svg>
  );
};

function MainApp({ signOut }: { signOut?: () => void }) {
  const [activeTab, setActiveTab] = useState<ViewTab>('Daily');
  const { profile, loading, inviteParent, fetchProfile } = useBabyProfile();
  
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  
  const isDesktopHeader = useMediaQuery('(min-width:735px)');
  
  // Track Snackbar for UI alerts
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  
  // Track onboarding gender preview
  const [previewGender, setPreviewGender] = useState<'girl' | 'boy' | null>(null);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Use a fallback theme for onboarding
  const activeGender = profile?.gender || previewGender || 'mixed';
  const theme = getTheme(activeGender);

  const handleInvite = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setSnackbar({ open: true, message: 'Please enter a valid email address.', severity: 'error' });
      return;
    }
    
    try {
      await inviteParent(inviteEmail.toLowerCase());
      await fetchProfile(); // refresh the profile to get updated parents list
      setInviteOpen(false);
      setInviteEmail('');
      setSnackbar({ open: true, message: 'Partner authorized successfully! An email has been sent to them.', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Failed to invite partner. Please try again.', severity: 'error' });
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 10 }}>
        {/* Header */}
        <Box sx={{ background: getHeaderGradient(activeGender), color: 'white', py: 2, px: 2, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {profile ? (
                  <>
                    <HeartIcon gender={profile.gender} />
                    {profile.name}
                    <HeartIcon gender={profile.gender} />
                  </>
                ) : 'Baby Tracker'}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 3 } }}>
                {isDesktopHeader && (
                  <Box sx={{ display: 'block' }}>
                    {profile && <HeaderStats />}
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {profile && profile.parents && profile.parents.length < 2 && (
                    <>
                      {isDesktopHeader ? (
                        <Button 
                          variant="outlined" color="inherit" size="small" 
                          startIcon={<PersonAddIcon />} onClick={() => setInviteOpen(true)}
                          sx={{ borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
                        >
                          Invite
                        </Button>
                      ) : (
                        <Button 
                          variant="outlined" color="inherit" size="small" 
                          onClick={() => setInviteOpen(true)}
                          sx={{ minWidth: 0, px: 1, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
                        >
                          <PersonAddIcon fontSize="small" />
                        </Button>
                      )}
                    </>
                  )}
                  {isDesktopHeader ? (
                    <Button 
                      variant="outlined" color="inherit" size="small" 
                      startIcon={<LogoutIcon />} onClick={signOut}
                      sx={{ borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
                    >
                      Logout
                    </Button>
                  ) : (
                    <Button 
                      variant="outlined" color="inherit" size="small" 
                      onClick={signOut}
                      sx={{ minWidth: 0, px: 1, borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
                    >
                      <LogoutIcon fontSize="small" />
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
            
            {profile && !isDesktopHeader && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <HeaderStats />
              </Box>
            )}
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: 2, px: { xs: 1, sm: 2, md: 3 } }}>
          {!profile ? (
            <OnboardingView onGenderChange={(val) => setPreviewGender(val)} />
          ) : (
            <>
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
            </>
          )}
        </Container>

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)}>
          <DialogTitle>Invite Partner</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Enter your partner's email. Once they sign up with this email, they will automatically be linked to this profile.
            </Typography>
            <TextField
              autoFocus
              margin="dense"
              label="Email Address"
              type="email"
              fullWidth
              variant="outlined"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} variant="contained">Authorize</Button>
          </DialogActions>
        </Dialog>
        
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <Authenticator socialProviders={['google']}>
      {({ signOut }) => (
        <BabyProfileProvider>
          <MainApp signOut={signOut} />
        </BabyProfileProvider>
      )}
    </Authenticator>
  );
}
