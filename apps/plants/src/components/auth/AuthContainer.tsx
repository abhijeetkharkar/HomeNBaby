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
      <div className="auth-page-backdrop">
        <div className="auth-spinner" aria-label="Loading authentication" />
      </div>
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
    <div className="auth-page-backdrop">
      <div className="auth-orb auth-orb-emerald" />
      <div className="auth-orb auth-orb-sage" />
      <div className="auth-orb auth-orb-sun" />
      <div className="auth-dot-grid" />

      <div className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-banner">
            <div className="auth-banner-icon">🌱</div>
            <h1 className="auth-banner-title">
              <span>🌿</span> Plants Tracker <span>🌿</span>
            </h1>
            <p className="auth-banner-subtitle">
              Indoor • Patio • Garden Care &amp; Schedules
            </p>
          </div>

          <div className="auth-body">
            {error && (
              <div className="auth-alert auth-alert-error" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  className="auth-alert-close"
                  onClick={clearMessages}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            {success && (
              <div className="auth-alert auth-alert-success" role="status">
                <span>{success}</span>
                <button
                  type="button"
                  className="auth-alert-close"
                  onClick={clearMessages}
                  aria-label="Dismiss message"
                >
                  ✕
                </button>
              </div>
            )}

            {renderStepContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
