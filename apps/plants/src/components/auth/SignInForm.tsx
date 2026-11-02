import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
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
    <form onSubmit={onSubmit} className="auth-form">
      <h2 className="auth-form-title">Welcome Back!</h2>
      <p className="auth-form-subtitle">
        Sign in to manage your home &amp; garden care schedules
      </p>

      <div className="auth-field">
        <label className="auth-label" htmlFor="signin-email">Email Address</label>
        <input
          id="signin-email"
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
        <label className="auth-label" htmlFor="signin-password">Password</label>
        <div className="auth-password-wrap">
          <input
            id="signin-password"
            type={showPassword ? 'text' : 'password'}
            className="auth-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
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
      </div>

      <div className="auth-forgot-row">
        <button
          type="button"
          className="auth-link-btn"
          onClick={() => setAuthStep('forgotPassword')}
        >
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        className="auth-submit-btn"
        disabled={loading || !email || !password}
      >
        {loading ? 'Signing In...' : '🌿 Sign In'}
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
        Don&apos;t have an account?{' '}
        <button
          type="button"
          className="auth-link-btn auth-link-strong"
          onClick={() => setAuthStep('signUp')}
        >
          Create Account
        </button>
      </p>
    </form>
  );
}
