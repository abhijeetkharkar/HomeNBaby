import { ConfigService } from '../config/config.service';

/**
 * Auth0 Machine-to-Machine authentication service for Windows agent
 * Handles client credentials flow for service-to-service authentication
 */
export interface M2MTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export class Auth0M2MService {
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private readonly config: ConfigService) {}

  private get clientId(): string {
    return this.config.get('auth0.clientId') as string;
  }

  private get clientSecret(): string {
    return this.config.get('auth0.clientSecret') as string;
  }

  private get domain(): string {
    return this.config.get('auth0.domain') as string;
  }

  private get audience(): string {
    return this.config.get('auth0.audience') as string;
  }

  /**
   * Get access token for API calls (with automatic refresh)
   * @returns Promise resolving to access token
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && Date.now() < (this.tokenExpiry - 300000)) {
      return this.accessToken;
    }

    try {
      const tokenResponse = await this.requestToken();
      
      this.accessToken = tokenResponse.access_token;
      this.tokenExpiry = Date.now() + (tokenResponse.expires_in * 1000);
      
      console.log('Auth0 M2M token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Auth0 M2M token:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Request new token from Auth0
   * @returns Promise resolving to token response
   */
  private async requestToken(): Promise<M2MTokenResponse> {
    const tokenUrl = `https://${this.domain}/oauth/token`;
    
    // Use native fetch (Node.js 18+) or require node-fetch for older versions
    const fetchImpl = globalThis.fetch || require('node-fetch');
    
    const response = await fetchImpl(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        audience: this.audience,
        grant_type: 'client_credentials',
        scope: 'read:cinemas write:cinemas delete:cinemas'
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token request failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<M2MTokenResponse>;
  }

  /**
   * Clear cached token (force refresh on next request)
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiry = 0;
  }
}