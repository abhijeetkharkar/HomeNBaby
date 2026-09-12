import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

export interface UserSession {
  userId: string;
  email: string;
  token: string;
  refreshToken?: string;
}

export interface AuthResponse {
  success: boolean;
  requiresConfirmation?: boolean;
  error?: string;
  userSub?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'cinema_auth_token';
  private readonly REFRESH_TOKEN_KEY = 'cinema_refresh_token';
  private readonly USER_KEY = 'cinema_auth_user';

  // Cognito Configuration
  private readonly cognitoEndpoint = 'https://cognito-idp.us-east-1.amazonaws.com/';
  private readonly clientId = '2mm23qkt8ve7etsdfbi70nk2b8';

  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3333/cinema-manager'
      : 'https://api.abhijeetkharkar.com/cinema-manager';

  readonly currentUser = signal<UserSession | null>(null);
  readonly isAuthenticated = signal<boolean>(false);

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  constructor() {
    this.initSession();
  }

  private initSession(): void {
    const savedToken = localStorage.getItem(this.TOKEN_KEY);
    const savedUser = localStorage.getItem(this.USER_KEY);
    if (savedToken && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch {
        this.logout();
      }
    }
  }

  /**
   * Helper to execute direct JSON-RPC calls to AWS Cognito Identity Provider
   */
  private async callCognito<T = any>(action: string, payload: Record<string, any>): Promise<T> {
    const response = await fetch(this.cognitoEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw data;
    }
    return data;
  }

  /**
   * Direct in-app sign in using USER_PASSWORD_AUTH
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await this.callCognito('InitiateAuth', {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email.trim(),
          PASSWORD: password,
        },
      });

      if (res.ChallengeName === 'CONFIRM_SIGN_UP') {
        return { success: false, requiresConfirmation: true };
      }

      if (res.AuthenticationResult) {
        const { IdToken, AccessToken, RefreshToken } = res.AuthenticationResult;
        this.saveAuthResult(IdToken || AccessToken, RefreshToken, email);
        return { success: true };
      }

      return { success: false, error: 'Unexpected authentication response.' };
    } catch (err: any) {
      if (err.__type === 'UserNotConfirmedException') {
        return { success: false, requiresConfirmation: true };
      }
      return { success: false, error: this.formatCognitoError(err) };
    }
  }

  /**
   * Direct in-app registration
   */
  async signUp(email: string, password: string): Promise<AuthResponse> {
    try {
      const res = await this.callCognito('SignUp', {
        ClientId: this.clientId,
        Username: email.trim(),
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email.trim() },
        ],
      });

      return {
        success: true,
        userSub: res.UserSub,
        requiresConfirmation: !res.UserConfirmed,
      };
    } catch (err: any) {
      return { success: false, error: this.formatCognitoError(err) };
    }
  }

  /**
   * Confirms registration with 6-digit email OTP
   */
  async confirmSignUp(email: string, code: string): Promise<AuthResponse> {
    try {
      await this.callCognito('ConfirmSignUp', {
        ClientId: this.clientId,
        Username: email.trim(),
        ConfirmationCode: code.trim(),
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: this.formatCognitoError(err) };
    }
  }

  /**
   * Resends confirmation code
   */
  async resendConfirmationCode(email: string): Promise<AuthResponse> {
    try {
      await this.callCognito('ResendConfirmationCode', {
        ClientId: this.clientId,
        Username: email.trim(),
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: this.formatCognitoError(err) };
    }
  }

  /**
   * Initiates forgot password code
   */
  async forgotPassword(email: string): Promise<AuthResponse> {
    try {
      await this.callCognito('ForgotPassword', {
        ClientId: this.clientId,
        Username: email.trim(),
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: this.formatCognitoError(err) };
    }
  }

  /**
   * Confirms password reset with code and new password
   */
  async confirmForgotPassword(email: string, code: string, newPassword: string): Promise<AuthResponse> {
    try {
      await this.callCognito('ConfirmForgotPassword', {
        ClientId: this.clientId,
        Username: email.trim(),
        ConfirmationCode: code.trim(),
        Password: newPassword,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: this.formatCognitoError(err) };
    }
  }

  /**
   * Saves tokens and populates user session
   */
  private saveAuthResult(token: string, refreshToken?: string, fallbackEmail?: string): void {
    try {
      const parts = token.split('.');
      let email = fallbackEmail || 'user@cinema.local';
      let userId = 'user';

      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        userId = payload.sub || payload.username || userId;
        email = payload.email || email;
      }

      const user: UserSession = {
        userId,
        email,
        token,
        refreshToken,
      };

      localStorage.setItem(this.TOKEN_KEY, token);
      if (refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));

      this.currentUser.set(user);
      this.isAuthenticated.set(true);
    } catch (e) {
      console.error('Failed to parse auth token payload:', e);
    }
  }

  /**
   * Clears session and redirects to /
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/']);
  }

  /**
   * Requests an ephemeral 6-digit Pairing Code from the API
   */
  async getPairingCode(): Promise<{ code: string; expiresAt: number }> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return firstValueFrom(
      this.http.post<{ code: string; expiresAt: number }>(
        `${this.apiUrl}/auth/pairing-code`,
        {},
        { headers }
      )
    );
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Maps Cognito raw errors to clean, friendly error messages
   */
  private formatCognitoError(err: any): string {
    const type = err?.__type || '';
    const message = err?.message || '';

    switch (type) {
      case 'UserNotFoundException':
        return 'No account found with this email address.';
      case 'NotAuthorizedException':
        return 'Incorrect email or password.';
      case 'UsernameExistsException':
        return 'An account with this email address already exists.';
      case 'CodeMismatchException':
        return 'Invalid verification code. Please check your email.';
      case 'ExpiredCodeException':
        return 'Verification code has expired. Please request a new code.';
      case 'InvalidPasswordException':
        return 'Password must be at least 8 characters and include uppercase, lowercase, and numbers.';
      case 'InvalidParameterException':
        return message || 'Invalid email or password format.';
      case 'LimitExceededException':
      case 'TooManyRequestsException':
        return 'Too many attempts. Please wait a few minutes before trying again.';
      default:
        return message || 'An unexpected authentication error occurred. Please try again.';
    }
  }
}
