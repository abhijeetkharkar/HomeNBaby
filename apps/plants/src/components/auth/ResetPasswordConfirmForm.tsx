import React, { useState } from 'react';
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
    <form onSubmit={onSubmit} className="auth-form auth-form-center">
      <h2 className="auth-form-title">Create New Password</h2>
      <p className="auth-form-subtitle">Enter the verification code sent to:</p>

      <div className="auth-email-pill">{email || 'your email'}</div>

      {validationError && (
        <div className="auth-alert auth-alert-error" role="alert">
          <span>{validationError}</span>
        </div>
      )}

      <div className="auth-field" style={{ textAlign: 'left' }}>
        <label className="auth-label" htmlFor="reset-code">Verification Code</label>
        <input
          id="reset-code"
          type="text"
          className="auth-input auth-otp-input"
          placeholder="123456"
          value={code}
          onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8))}
          maxLength={8}
          autoFocus
          required
        />
      </div>

      <div className="auth-field" style={{ textAlign: 'left' }}>
        <label className="auth-label" htmlFor="reset-new-password">New Password</label>
        <div className="auth-password-wrap">
          <input
            id="reset-new-password"
            type={showPassword ? 'text' : 'password'}
            className="auth-input"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
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
      </div>

      <div className="auth-field" style={{ textAlign: 'left' }}>
        <label className="auth-label" htmlFor="reset-confirm-password">Confirm New Password</label>
        <input
          id="reset-confirm-password"
          type={showPassword ? 'text' : 'password'}
          className="auth-input"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
          autoComplete="new-password"
          required
        />
      </div>

      <button
        type="submit"
        className="auth-submit-btn"
        disabled={loading || !code.trim() || !newPassword || !confirmPassword}
      >
        {loading ? 'Updating Password...' : '✓ Reset & Save Password'}
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
