import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface UserSession {
  userId: string;
  email: string;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'cinema_auth_token';
  private readonly USER_KEY = 'cinema_auth_user';

  // Cognito Configuration
  private readonly cognitoDomain = 'cinema-abhijeetkharkar-prod.auth.us-east-1.amazoncognito.com';
  private readonly clientId = '6ci895vprgja3c4ts2kit1urvl'; // Default / fallback or configured

  private readonly apiUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3333/cinema-manager'
      : 'https://api.abhijeetkharkar.com/cinema-manager';

  readonly currentUser = signal<UserSession | null>(null);
  readonly isAuthenticated = signal<boolean>(false);

  constructor(private readonly http: HttpClient) {
    this.initSession();
  }

  /**
   * Initializes session from localStorage or URL hash
   */
  private initSession(): void {
    // 1. Check if returning from Cognito redirect with #id_token=... or ?id_token=...
    const hash = window.location.hash || window.location.search;
    if (hash.includes('id_token=') || hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^[#?]/, ''));
      const idToken = params.get('id_token') || params.get('access_token');
      if (idToken) {
        this.saveToken(idToken);
        // Clean URL hash without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }

    // 2. Check localStorage
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
   * Redirects to Cognito Hosted UI Sign-In page
   */
  login(): void {
    const redirectUri = window.location.origin + '/';
    const loginUrl = `https://${this.cognitoDomain}/login?client_id=${this.clientId}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = loginUrl;
  }

  /**
   * Redirects to Cognito Hosted UI Sign-Up page
   */
  signup(): void {
    const redirectUri = window.location.origin + '/';
    const signupUrl = `https://${this.cognitoDomain}/signup?client_id=${this.clientId}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = signupUrl;
  }

  /**
   * Clears session and logs out
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
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

  private saveToken(token: string): void {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const user: UserSession = {
          userId: payload.sub || payload.username || 'user',
          email: payload.email || 'user@cinema.local',
          token,
        };
        localStorage.setItem(this.TOKEN_KEY, token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      }
    } catch (e) {
      console.error('Failed to parse token payload:', e);
    }
  }
}
