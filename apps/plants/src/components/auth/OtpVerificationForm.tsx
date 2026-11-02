import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export function OtpVerificationForm() {
  const { email, handleConfirmSignUp, handleResendCode, setAuthStep, loading } = useAuth();
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
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
    <form onSubmit={onSubmit} className="auth-form auth-form-center">
      <div className="auth-circle-badge">📬</div>
      <h2 className="auth-form-title">Check Your Email</h2>
      <p className="auth-form-subtitle">
        We sent a 6-digit verification code to:
      </p>

      <div className="auth-email-pill">{email || 'your email'}</div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="otp-code">Verification Code</label>
        <input
          id="otp-code"
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

      <button
        type="submit"
        className="auth-submit-btn"
        disabled={loading || !code.trim()}
      >
        {loading ? 'Verifying...' : '✓ Verify & Continue'}
      </button>

      <div className="auth-resend-row">
        <span>Didn&apos;t receive the code?</span>
        <button
          type="button"
          className="auth-link-btn auth-link-strong"
          onClick={onResend}
          disabled={!canResend || loading}
        >
          {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
        </button>
      </div>

      <p className="auth-footer-text">
        <button
          type="button"
          className="auth-link-btn"
          onClick={() => setAuthStep('signUp')}
        >
          ← Back to Sign Up
        </button>
      </p>
    </form>
  );
}
