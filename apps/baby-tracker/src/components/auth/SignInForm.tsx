import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Divider,
  InputAdornment,
  IconButton,
  CircularProgress
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LoginIcon from '@mui/icons-material/Login';
import { useAuth } from '../../context/AuthContext';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

export function SignInForm() {
  const { handleSignIn, handleGoogleSignIn, setAuthStep, loading, email: initialEmail } = useAuth();
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await handleSignIn(email, password);
  };

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ mt: 1 }}>
      <Typography variant="h6" fontWeight="bold" align="center" sx={{ mb: 0.5, color: '#333' }}>
        Welcome Back!
      </Typography>
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Sign in to track your baby's daily routine & milestones
      </Typography>

      <TextField
        fullWidth
        label="Email Address"
        type="email"
        variant="outlined"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        label="Password"
        type={showPassword ? 'text' : 'password'}
        variant="outlined"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
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
        sx={{ mb: 1 }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => setAuthStep('forgotPassword')}
          sx={{
            color: 'primary.main',
            fontWeight: 500,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          Forgot password?
        </Link>
      </Box>

      <Button
        type="submit"
        fullWidth
        variant="contained"
        size="large"
        disabled={loading || !email || !password}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
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
        {loading ? 'Signing In...' : 'Sign In'}
      </Button>

      <Divider sx={{ my: 2.5, fontSize: '0.85rem', color: 'text.secondary' }}>
        or
      </Divider>

      <Button
        type="button"
        fullWidth
        variant="outlined"
        size="large"
        onClick={handleGoogleSignIn}
        disabled={loading}
        startIcon={<GoogleIcon />}
        sx={{
          py: 1.2,
          color: '#444',
          borderColor: '#e0e0e0',
          backgroundColor: '#fff',
          fontWeight: 500,
          '&:hover': {
            borderColor: '#bbb',
            backgroundColor: '#f9f9f9',
          }
        }}
      >
        Continue with Google
      </Button>

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Don't have an account?{' '}
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={() => setAuthStep('signUp')}
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            Create Account
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
