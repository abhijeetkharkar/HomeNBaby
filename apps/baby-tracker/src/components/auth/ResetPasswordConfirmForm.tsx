import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  CircularProgress,
  Paper,
  Alert
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';

export function ResetPasswordConfirmForm() {
  const { email, handleConfirmResetPassword, setAuthStep, loading } = useAuth();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!code.trim() || !newPassword || !confirmPassword) return;

    if (newPassword.length < 8) {
      setValidationError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    await handleConfirmResetPassword(code.trim(), newPassword);
  };

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ mt: 1, textAlign: 'center' }}>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, color: '#333' }}>
        Create New Password
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the verification code sent to:
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          py: 0.8,
          px: 2,
          display: 'inline-block',
          mb: 2.5,
          bgcolor: 'rgba(91, 140, 185, 0.08)',
          borderColor: 'rgba(91, 140, 185, 0.2)',
          borderRadius: 2
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} color="#333">
          {email || 'your email'}
        </Typography>
      </Paper>

      {validationError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2, textAlign: 'left' }}>
          {validationError}
        </Alert>
      )}

      <TextField
        fullWidth
        autoFocus
        label="Verification Code"
        placeholder="123456"
        variant="outlined"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8))}
        required
        inputProps={{
          style: {
            textAlign: 'center',
            letterSpacing: '0.3em',
            fontSize: '1.2rem',
            fontWeight: 700
          },
          maxLength: 8
        }}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="New Password"
        type={showPassword ? 'text' : 'password'}
        variant="outlined"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        autoComplete="new-password"
        helperText="Must be at least 8 characters"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                size="small"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Confirm New Password"
        type={showPassword ? 'text' : 'password'}
        variant="outlined"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading || !code.trim() || !newPassword || !confirmPassword}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlineIcon />}
        sx={{
          py: 1.3,
          fontSize: '1rem',
          fontWeight: 600,
          background: 'linear-gradient(135deg, #d4788c 0%, #5B8CB9 100%)',
          boxShadow: '0 4px 14px rgba(212, 120, 140, 0.35)',
          '&:hover': {
            background: 'linear-gradient(135deg, #c0657a 0%, #4a7aa7 100%)',
          }
        }}
      >
        {loading ? 'Updating Password...' : 'Reset & Save Password'}
      </Button>

      <Box sx={{ mt: 3 }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => setAuthStep('signIn')}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'text.secondary',
            textDecoration: 'none',
            '&:hover': { color: 'primary.main', textDecoration: 'underline' }
          }}
        >
          <ArrowBackIcon fontSize="small" /> Back to Sign In
        </Link>
      </Box>
    </Box>
  );
}
