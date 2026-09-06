import React from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Fade,
  CircularProgress
} from '@mui/material';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useAuth } from '../../context/AuthContext';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { OtpVerificationForm } from './OtpVerificationForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetPasswordConfirmForm } from './ResetPasswordConfirmForm';

export function AuthContainer() {
  const { authStep, error, success, clearMessages, initialCheckLoading } = useAuth();

  if (initialCheckLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          bgcolor: '#faf7f5'
        }}
      >
        <CircularProgress sx={{ color: '#d4788c' }} />
      </Box>
    );
  }

  const renderStepContent = () => {
    switch (authStep) {
      case 'signUp':
        return <SignUpForm />;
      case 'confirmSignUp':
        return <OtpVerificationForm />;
      case 'forgotPassword':
        return <ForgotPasswordForm />;
      case 'confirmResetPassword':
        return <ResetPasswordConfirmForm />;
      case 'signIn':
      default:
        return <SignInForm />;
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        bgcolor: '#fcf9f8',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: { xs: 3, sm: 6 },
        px: 2,
        '@keyframes breathePink': {
          '0%, 100%': {
            transform: 'scale(1) translate(0px, 0px)',
            opacity: 0.55,
          },
          '50%': {
            transform: 'scale(1.22) translate(30px, -25px)',
            opacity: 0.8,
          },
        },
        '@keyframes breatheBlue': {
          '0%, 100%': {
            transform: 'scale(1.15) translate(0px, 0px)',
            opacity: 0.5,
          },
          '50%': {
            transform: 'scale(0.92) translate(-35px, 30px)',
            opacity: 0.75,
          },
        },
        '@keyframes breatheLavender': {
          '0%, 100%': {
            transform: 'scale(0.95) translate(0px, 0px)',
            opacity: 0.4,
          },
          '50%': {
            transform: 'scale(1.18) translate(20px, 25px)',
            opacity: 0.68,
          },
        },
        '@keyframes cardEntrance': {
          '0%': {
            opacity: 0,
            transform: 'translateY(22px) scale(0.97)',
          },
          '100%': {
            opacity: 1,
            transform: 'translateY(0) scale(1)',
          },
        },
        '@keyframes gentleHeartbeat': {
          '0%, 100%': {
            transform: 'scale(1)',
          },
          '12%': {
            transform: 'scale(1.14)',
          },
          '24%': {
            transform: 'scale(1)',
          },
          '36%': {
            transform: 'scale(1.09)',
          },
          '60%': {
            transform: 'scale(1)',
          },
        },
        '@keyframes floatBaby': {
          '0%, 100%': {
            transform: 'translateY(0)',
          },
          '50%': {
            transform: 'translateY(-4px)',
          },
        },
      }}
    >
      {/* Background Animated Throbbing / Breathing Glowing Orbs */}
      <Box
        sx={{
          position: 'absolute',
          top: '-8%',
          left: '-5%',
          width: { xs: 280, sm: 420 },
          height: { xs: 280, sm: 420 },
          borderRadius: '50%',
          background: 'radial-gradient(circle, #f8bbd0 0%, #f48fb1 45%, rgba(244, 143, 177, 0) 70%)',
          filter: 'blur(60px)',
          animation: 'breathePink 8s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          bottom: '-10%',
          right: '-5%',
          width: { xs: 300, sm: 460 },
          height: { xs: 300, sm: 460 },
          borderRadius: '50%',
          background: 'radial-gradient(circle, #bbdefb 0%, #90caf9 45%, rgba(144, 202, 249, 0) 70%)',
          filter: 'blur(70px)',
          animation: 'breatheBlue 10s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: 240, sm: 360 },
          height: { xs: 240, sm: 360 },
          borderRadius: '50%',
          background: 'radial-gradient(circle, #e1bee7 0%, #ce93d8 40%, rgba(206, 147, 216, 0) 70%)',
          filter: 'blur(65px)',
          animation: 'breatheLavender 9s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Subtle Dot Grid Layer */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(212, 120, 140, 0.12) 1.2px, transparent 1.2px), radial-gradient(rgba(91, 140, 185, 0.12) 1.2px, transparent 1.2px)',
          backgroundSize: '36px 36px',
          backgroundPosition: '0 0, 18px 18px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <Container
        maxWidth="xs"
        sx={{
          position: 'relative',
          zIndex: 2,
          px: { xs: 0, sm: 2 },
          animation: 'cardEntrance 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        <Paper
          elevation={6}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(91, 140, 185, 0.12), 0 6px 16px rgba(212, 120, 140, 0.08)',
            bgcolor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
          }}
        >
          {/* Baby Header Banner */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #d4788c 0%, #e895a6 42%, #5B8CB9 100%)',
              color: 'white',
              pt: 3.5,
              pb: 3,
              px: 3,
              textAlign: 'center',
              boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
              position: 'relative',
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 54,
                height: 54,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 255, 255, 0.28)',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                mb: 1.2,
                animation: 'floatBaby 3.5s ease-in-out infinite',
              }}
            >
              <ChildCareIcon sx={{ fontSize: 34, color: '#ffffff' }} />
            </Box>

            <Typography
              variant="h5"
              fontWeight="bold"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                letterSpacing: '-0.02em',
                textShadow: '0 1px 3px rgba(0,0,0,0.18)',
              }}
            >
              <FavoriteIcon
                sx={{
                  fontSize: 16,
                  color: '#ffd1dc',
                  animation: 'gentleHeartbeat 2.4s ease-in-out infinite',
                }}
              />
              Baby Tracker
              <FavoriteIcon
                sx={{
                  fontSize: 16,
                  color: '#bbdefb',
                  animation: 'gentleHeartbeat 2.4s ease-in-out infinite 0.3s',
                }}
              />
            </Typography>

            <Typography
              variant="caption"
              sx={{
                opacity: 0.92,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'block',
                mt: 0.3,
              }}
            >
              Daily Logs • Feeds • Sleep • Growth
            </Typography>
          </Box>

          {/* Form Content Body */}
          <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            {error && (
              <Fade in={Boolean(error)}>
                <Alert
                  severity="error"
                  onClose={clearMessages}
                  sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.875rem' }}
                >
                  {error}
                </Alert>
              </Fade>
            )}

            {success && (
              <Fade in={Boolean(success)}>
                <Alert
                  severity="success"
                  onClose={clearMessages}
                  sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.875rem' }}
                >
                  {success}
                </Alert>
              </Fade>
            )}

            {renderStepContent()}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
