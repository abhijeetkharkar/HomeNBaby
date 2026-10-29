import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signIn,
  signUp,
  confirmSignUp,
  resendSignUpCode,
  signInWithRedirect,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  signOut as amplifySignOut,
  type AuthUser,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

export type AuthStep =
  | 'signIn'
  | 'signUp'
  | 'confirmSignUp'
  | 'forgotPassword'
  | 'confirmResetPassword';

interface AuthContextType {
  user: AuthUser | null;
  userEmail: string;
  authStep: AuthStep;
  email: string;
  loading: boolean;
  initialCheckLoading: boolean;
  error: string | null;
  success: string | null;
  setAuthStep: (step: AuthStep) => void;
  setEmail: (email: string) => void;
  clearMessages: () => void;
  getIdToken: () => Promise<string | null>;
  handleSignIn: (email: string, pass: string) => Promise<void>;
  handleSignUp: (email: string, pass: string) => Promise<void>;
  handleConfirmSignUp: (code: string) => Promise<void>;
  handleResendCode: () => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  handleForgotPassword: (email: string) => Promise<void>;
  handleConfirmResetPassword: (code: string, newPass: string) => Promise<void>;
  handleSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapAuthError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return 'An unexpected error occurred. Please try again.';
  }
  const e = err as { name?: string; __type?: string; message?: string };
  const name = e.name || e.__type || '';
  const message = e.message || '';

  if (name === 'UserNotFoundException' || message.includes('User does not exist')) {
    return 'No account found with this email address.';
  }
  if (name === 'NotAuthorizedException' || message.includes('Incorrect username or password')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (name === 'UsernameExistsException' || message.includes('User already exists')) {
    return 'An account with this email already exists. Please sign in instead.';
  }
  if (name === 'CodeMismatchException' || message.includes('Invalid verification code')) {
    return 'Invalid verification code. Please check the code and try again.';
  }
  if (name === 'ExpiredCodeException' || message.includes('expired')) {
    return 'The verification code has expired. Please click "Resend Code".';
  }
  if (name === 'LimitExceededException') {
    return 'Too many attempts. Please wait a few minutes before trying again.';
  }
  if (name === 'InvalidPasswordException' || message.includes('Password did not conform with policy')) {
    return 'Password must be at least 8 characters with lowercase, uppercase, numbers, and symbols.';
  }
  if (name === 'UserNotConfirmedException') {
    return 'Account is not confirmed yet. Please enter the verification code sent to your email.';
  }

  return message || 'Authentication failed. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [authStep, setAuthStep] = useState<AuthStep>('signIn');
  const [email, setEmail] = useState<string>('');
  const [savedPassword, setSavedPassword] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [initialCheckLoading, setInitialCheckLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch {
      return null;
    }
  }, []);

  const checkCurrentUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const claimEmail = String(session.tokens?.idToken?.payload?.email || currentUser.signInDetails?.loginId || '');
      setUser(currentUser);
      setUserEmail(claimEmail.toLowerCase());
    } catch {
      setUser(null);
      setUserEmail('');
    } finally {
      setInitialCheckLoading(false);
    }
  }, []);

  useEffect(() => {
    checkCurrentUser();

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'signInWithRedirect':
          checkCurrentUser();
          break;
        case 'signedOut':
          setUser(null);
          setUserEmail('');
          setAuthStep('signIn');
          break;
        case 'signInWithRedirect_failure':
          setError('Google sign-in was cancelled or failed.');
          break;
        default:
          break;
      }
    });

    return () => unsubscribe();
  }, [checkCurrentUser]);

  const handleSignIn = async (inputEmail: string, pass: string) => {
    setLoading(true);
    clearMessages();
    const cleanEmail = inputEmail.trim().toLowerCase();
    setEmail(cleanEmail);
    try {
      const { isSignedIn, nextStep } = await signIn({
        username: cleanEmail,
        password: pass,
      });

      if (isSignedIn) {
        await checkCurrentUser();
      } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setSavedPassword(pass);
        setAuthStep('confirmSignUp');
        setSuccess('Please enter the verification code sent to your email.');
      } else {
        setError(`Additional step required: ${nextStep.signInStep}`);
      }
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e?.name === 'UserNotConfirmedException') {
        setSavedPassword(pass);
        setAuthStep('confirmSignUp');
        try {
          await resendSignUpCode({ username: cleanEmail });
        } catch {
          // ignore resend error
        }
        setError('Your account is not verified yet. We sent a new verification code to your email.');
      } else {
        setError(mapAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (inputEmail: string, pass: string) => {
    setLoading(true);
    clearMessages();
    const cleanEmail = inputEmail.trim().toLowerCase();
    setEmail(cleanEmail);
    setSavedPassword(pass);
    try {
      const { isSignUpComplete, nextStep } = await signUp({
        username: cleanEmail,
        password: pass,
        options: {
          userAttributes: {
            email: cleanEmail,
          },
        },
      });

      if (isSignUpComplete) {
        await handleSignIn(cleanEmail, pass);
      } else if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setAuthStep('confirmSignUp');
        setSuccess(`A verification code was sent to ${cleanEmail}`);
      }
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (code: string) => {
    setLoading(true);
    clearMessages();
    try {
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode: code.trim(),
      });

      if (isSignUpComplete) {
        setSuccess('Account verified! Signing you in...');
        if (savedPassword) {
          try {
            await handleSignIn(email, savedPassword);
            setSavedPassword('');
            return;
          } catch {
            // fallback to manual sign-in
          }
        }
        setAuthStep('signIn');
        setSuccess('Account verified! Please enter your password to sign in.');
      }
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    clearMessages();
    try {
      await resendSignUpCode({ username: email });
      setSuccess(`A new verification code has been sent to ${email}`);
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearMessages();
    try {
      await signInWithRedirect({ provider: 'Google' });
    } catch (err: unknown) {
      setError(mapAuthError(err));
    }
  };

  const handleForgotPassword = async (inputEmail: string) => {
    setLoading(true);
    clearMessages();
    const cleanEmail = inputEmail.trim().toLowerCase();
    setEmail(cleanEmail);
    try {
      const output = await resetPassword({ username: cleanEmail });
      if (output.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
        setAuthStep('confirmResetPassword');
        setSuccess(`Reset code sent to ${cleanEmail}`);
      } else {
        setSuccess('Password reset initiated. Check your email for instructions.');
      }
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (code: string, newPass: string) => {
    setLoading(true);
    clearMessages();
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code.trim(),
        newPassword: newPass,
      });
      setAuthStep('signIn');
      setSuccess('Password reset! You can now sign in with your new password.');
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    clearMessages();
    try {
      await amplifySignOut();
      setUser(null);
      setUserEmail('');
      setAuthStep('signIn');
    } catch (err: unknown) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const changeAuthStep = (step: AuthStep) => {
    clearMessages();
    setAuthStep(step);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userEmail,
        authStep,
        email,
        loading,
        initialCheckLoading,
        error,
        success,
        setAuthStep: changeAuthStep,
        setEmail,
        clearMessages,
        getIdToken,
        handleSignIn,
        handleSignUp,
        handleConfirmSignUp,
        handleResendCode,
        handleGoogleSignIn,
        handleForgotPassword,
        handleConfirmResetPassword,
        handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
