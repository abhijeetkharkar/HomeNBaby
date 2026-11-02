import React, { useState } from 'react';
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
    <form onSubmit={onSubmit} className="auth-form auth-form-center">
      <div className="auth-circle-badge">🔑</div>
      <h2 className="auth-form-title">Reset Password</h2>
      <p className="auth-form-subtitle">
        Enter your account email and we will send a verification code to reset your password.
      </p>

      <div className="auth-field" style={{ textAlign: 'left' }}>
        <label className="auth-label" htmlFor="forgot-email">Email Address</label>
        <input
          id="forgot-email"
          type="email"
          className="auth-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
        />
      </div>

      <button
        type="submit"
        className="auth-submit-btn"
        disabled={loading || !email}
      >
        {loading ? 'Sending Code...' : 'Send Reset Code'}
      </button>

      <p className="auth-footer-text">
        <button
          type="button"
          className="auth-link-btn"
          onClick={() => setAuthStep('signIn')}
        >
          ← Back to Sign In
        </button>
      </p>
    </form>
  );
}
