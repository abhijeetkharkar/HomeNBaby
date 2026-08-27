import { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useBabyProfile } from '../../hooks/useBabyProfile';

export function OnboardingView({ onGenderChange }: { onGenderChange?: (g: 'girl'|'boy'|null) => void }) {
  const { createProfile } = useBabyProfile();
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'girl' | 'boy' | null>(null);
  const [dob, setDob] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !gender || !dob) return;
    setLoading(true);
    try {
      await createProfile(name, gender, dob);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 400, width: '100%', borderRadius: 3 }}>
        <Typography variant="h5" fontWeight="bold" align="center" gutterBottom>
          Welcome to Baby Tracker
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Let's set up your baby's profile to get started.
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Baby's Name"
            variant="outlined"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 3 }}
            required
          />

          <TextField
            fullWidth
            type="date"
            label="Date of Birth"
            variant="outlined"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            sx={{ mb: 3 }}
            InputLabelProps={{ shrink: true }}
            required
          />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Gender</Typography>
          <ToggleButtonGroup
            value={gender}
            exclusive
            onChange={(_, val) => {
              if (val) {
                setGender(val);
                if (onGenderChange) onGenderChange(val);
              }
            }}
            fullWidth
            sx={{ mb: 4 }}
          >
            <ToggleButton value="girl">Girl 🩷</ToggleButton>
            <ToggleButton value="boy">Boy 💙</ToggleButton>
          </ToggleButtonGroup>

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            disabled={!name || loading}
          >
            {loading ? 'Creating...' : 'Create Profile'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
