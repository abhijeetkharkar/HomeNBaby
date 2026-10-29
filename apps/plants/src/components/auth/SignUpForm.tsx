import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GoogleIcon } from './SignInForm';

export function SignUpForm() {
  const { handleSignUp, handleGoogleSignIn, setAuthStep, loading, email: initialEmail } = useAuth();
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!email || !password || !confirmPassword) return;

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    await handleSignUp(email, password);
  };

  return (
    <form onSubmit={onSubmit} className="auth-form">
      <h2 className="auth-form-title">Create an Account</h2>
      <p className="auth-form-subtitle">
        Set up your home &amp; garden and track watering and fertilizing
      </p>

      {validationError && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>{validationError}</span>
        </div>
      )}

      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-email">Email Address</label>
        <input
          id="signup-email"
          type="email"
          className="auth-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-password">Password</label>
        <div className="auth-password-wrap">
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            className="auth-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="auth-eye-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Toggle password visibility"
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        <span className="auth-helper">Must be at least 8 characters with upper, lower, number &amp; symbol</span>
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="signup-confirm-password">Confirm Password</label>
        <input
          id="signup-confirm-password"
          type={showPassword ? 'text' : 'password'}
          className="auth-input"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
          required
        />
      </div>

      <button
        type="submit"
        className="auth-submit-btn"
        disabled={loading || !email || !password || !confirmPassword}
      >
        {loading ? 'Creating Account...' : '🌱 Create Account'}
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="auth-google-btn"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>

      <p className="auth-footer-text">
        Already have an account?{' '}
        <button
          type="button"
          className="auth-link-btn auth-link-strong"
          onClick={() => setAuthStep('signIn')}
        >
          Sign In
        </button>
      </p>
    </form>
  );
}
