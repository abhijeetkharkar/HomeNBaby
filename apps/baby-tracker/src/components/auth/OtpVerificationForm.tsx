import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress,
  Paper
} from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';

export function OtpVerificationForm() {
  const { email, handleConfirmSignUp, handleResendCode, setAuthStep, loading } = useAuth();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    } else {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const onResend = async () => {
    if (!canResend || loading) return;
    await handleResendCode();
    setCountdown(30);
    setCanResend(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await handleConfirmSignUp(code.trim());
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
        <MarkEmailReadIcon sx={{ fontSize: 36, color: '#d4788c' }} />
      </Box>

      <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5, color: '#333' }}>
        Check Your Email
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        We have sent a 6-digit confirmation code to:
      </Typography>

      <Paper
        variant="outlined"
        sx={{
          py: 0.8,
          px: 2,
          display: 'inline-block',
          mb: 3,
          bgcolor: 'rgba(91, 140, 185, 0.08)',
          borderColor: 'rgba(91, 140, 185, 0.2)',
          borderRadius: 2
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} color="#333">
          {email || 'your email'}
        </Typography>
      </Paper>

      <TextField
        fullWidth
        autoFocus
        label="Verification Code"
        placeholder="123456"
        variant="outlined"
        value={code}
        onChange={(e) => {
          // Allow only alphanumeric / digits and cap at 10 chars
          const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
          setCode(val);
        }}
        required
        inputProps={{
          style: {
            textAlign: 'center',
            letterSpacing: '0.35em',
            fontSize: '1.4rem',
            fontWeight: 700
          },
          maxLength: 8
        }}
        sx={{ mb: 3 }}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading || !code.trim()}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VerifiedUserIcon />}
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
        {loading ? 'Verifying...' : 'Verify & Continue'}
      </Button>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Didn't receive the code?
        </Typography>
        <Button
          type="button"
          size="small"
          onClick={onResend}
          disabled={!canResend || loading}
          startIcon={<RefreshIcon fontSize="small" />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: canResend ? 'primary.main' : 'text.disabled'
          }}
        >
          {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
        </Button>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => setAuthStep('signUp')}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'text.secondary',
            textDecoration: 'none',
            '&:hover': { color: 'primary.main', textDecoration: 'underline' }
          }}
        >
          <ArrowBackIcon fontSize="small" /> Back to Sign Up
        </Link>
      </Box>
    </Box>
  );
}
