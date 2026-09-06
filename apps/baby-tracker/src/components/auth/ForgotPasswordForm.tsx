import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';

export function ForgotPasswordForm() {
  const { handleForgotPassword, setAuthStep, loading, email: initialEmail } = useAuth();
  const [email, setEmail] = useState(initialEmail || '');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    await handleForgotPassword(email);
  };

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ mt: 1, textAlign: 'center' }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(212, 120, 140, 0.15) 0%, rgba(91, 140, 185, 0.15) 100%)',
          color: 'primary.main',
          mb: 2
        }}
      >
        <LockResetIcon sx={{ fontSize: 36, color: '#5B8CB9' }} />
      </Box>

      <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, color: '#333' }}>
        Reset Password
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your account email address and we will send you a verification code to reset your password.
      </Typography>

      <TextField
        fullWidth
        autoFocus
        label="Email Address"
        type="email"
        variant="outlined"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading || !email}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
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
        {loading ? 'Sending Code...' : 'Send Reset Code'}
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
