import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

export type AuthStep =
  | 'signIn'
  | 'signUp'
  | 'confirmSignUp'
  | 'forgotPassword'
  | 'confirmResetPassword';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
})
export class AuthComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  authStep: AuthStep = 'signIn';
  returnUrl = '/dashboard';

  // Form Fields
  email = '';
  password = '';
  confirmPassword = '';
  verificationCode = '';
  newPassword = '';
  confirmNewPassword = '';

  // UI State
  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    const returnParam = this.route.snapshot.queryParams['returnUrl'];
    if (returnParam) {
      this.returnUrl = returnParam;
    }

    const stepParam = this.route.snapshot.queryParams['step'];
    if (stepParam && ['signIn', 'signUp', 'confirmSignUp', 'forgotPassword'].includes(stepParam)) {
      this.authStep = stepParam as AuthStep;
    }
  }

  setStep(step: AuthStep): void {
    this.authStep = step;
    this.errorMessage = '';
    this.successMessage = '';
  }

  async handleSignIn(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const res = await this.authService.signIn(this.email, this.password);
      if (res.success) {
        this.router.navigateByUrl(this.returnUrl);
      } else if (res.requiresConfirmation) {
        this.successMessage = 'Account requires email verification. We sent a code to your email.';
        this.authStep = 'confirmSignUp';
      } else {
        this.errorMessage = res.error || 'Sign in failed.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleSignUp(): Promise<void> {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'Password must be at least 8 characters long.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const res = await this.authService.signUp(this.email, this.password);
      if (res.success) {
        this.successMessage = `Verification code sent to ${this.email}. Please check your inbox.`;
        this.authStep = 'confirmSignUp';
      } else {
        this.errorMessage = res.error || 'Sign up failed.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleConfirmSignUp(): Promise<void> {
    if (!this.email || !this.verificationCode) {
      this.errorMessage = 'Please enter the 6-digit confirmation code.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const res = await this.authService.confirmSignUp(this.email, this.verificationCode);
      if (res.success) {
        // If password is available in component state, auto sign in!
        if (this.password) {
          const loginRes = await this.authService.signIn(this.email, this.password);
          if (loginRes.success) {
            this.router.navigateByUrl(this.returnUrl);
            return;
          }
        }
        this.successMessage = 'Email verified successfully! You can now sign in.';
        this.authStep = 'signIn';
      } else {
        this.errorMessage = res.error || 'Verification failed.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleResendCode(): Promise<void> {
    if (!this.email) {
      this.errorMessage = 'Please enter your email address.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const res = await this.authService.resendConfirmationCode(this.email);
      if (res.success) {
        this.successMessage = 'A new verification code has been sent to your email.';
      } else {
        this.errorMessage = res.error || 'Failed to resend code.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleForgotPassword(): Promise<void> {
    if (!this.email) {
      this.errorMessage = 'Please enter your email address.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const res = await this.authService.forgotPassword(this.email);
      if (res.success) {
        this.successMessage = 'Password reset code sent. Check your inbox.';
        this.authStep = 'confirmResetPassword';
      } else {
        this.errorMessage = res.error || 'Failed to request password reset.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  async handleConfirmResetPassword(): Promise<void> {
    if (!this.email || !this.verificationCode || !this.newPassword) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'New password must be at least 8 characters long.';
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const res = await this.authService.confirmForgotPassword(
        this.email,
        this.verificationCode,
        this.newPassword
      );
      if (res.success) {
        this.successMessage = 'Password reset successfully! You can now sign in with your new password.';
        this.password = this.newPassword;
        this.authStep = 'signIn';
      } else {
        this.errorMessage = res.error || 'Password reset failed.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}
