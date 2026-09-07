// Use native fetch (Node.js 18+) or require node-fetch for older versions
const fetch = globalThis.fetch || require('node-fetch');
import * as os from 'os';
import { Auth0M2MService } from '../auth/auth0-m2m.service';
import { ConfigService } from '../config/config.service';
import { CreateCinemaDto, CinemaFile } from '@cinema-manager/models';

/**
 * API client service for communicating with the Cinema Manager API
 * Uses Auth0 machine-to-machine authentication when configured
 */
export class CinemaManagerApiService {
  private readonly baseUrl: string;
  private readonly agentId: string;

  constructor(
    private auth0Service: Auth0M2MService,
    private configService: ConfigService
  ) {
    this.baseUrl = configService.get('api.baseUrl') as string;
    this.agentId = configService.get('agent.id') as string;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `CinemaManagerAgent/${this.getVersion()}`,
    };
    const token = await this.auth0Service.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Upload cinema data to API
   */
  async createCinema(cinema: Omit<CreateCinemaDto, 'agentId'>): Promise<CinemaFile> {
    try {
      const headers = await this.getHeaders();
      const cinemaData: CreateCinemaDto = {
        ...cinema,
        agentId: this.agentId,
      };

      const response = await fetch(`${this.baseUrl}/api/cinemas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(cinemaData),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.auth0Service.clearToken();
          return this.createCinema(cinema);
        }
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return (await response.json()) as CinemaFile;
    } catch (error) {
      console.error('Failed to create cinema:', error);
      throw error;
    }
  }

  /**
   * Get cinema by file path
   */
  async getCinemaByPath(filePath: string): Promise<CinemaFile | null> {
    try {
      const headers = await this.getHeaders();
      const encodedPath = encodeURIComponent(filePath);
      const response = await fetch(
        `${this.baseUrl}/api/cinemas/by-path?filePath=${encodedPath}&agentId=${this.agentId}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.auth0Service.clearToken();
          return this.getCinemaByPath(filePath);
        }
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return (await response.json()) as CinemaFile;
    } catch (error) {
      console.error('Failed to get cinema by path:', error);
      throw error;
    }
  }

  /**
   * Delete cinema from API
   */
  async deleteCinema(cinemaId: string | number): Promise<void> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/api/cinemas/${cinemaId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.auth0Service.clearToken();
          return this.deleteCinema(cinemaId);
        }
        if (response.status === 404) {
          console.warn(`Cinema not found for deletion: ${cinemaId}`);
          return;
        }
        const errorText = await response.text();
        throw new Error(`Delete request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
    } catch (error) {
      console.error('Failed to delete cinema:', error);
      throw error;
    }
  }

  /**
   * Test API connectivity and authentication
   */
  async testConnection(): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers,
      });
      return response.ok;
    } catch (error) {
      console.warn('API connection test notice:', error);
      return false;
    }
  }

  /**
   * Send heartbeat to backend API
   */
  async sendHeartbeat(watchPaths: string[]): Promise<void> {
    try {
      const headers = await this.getHeaders();
      const agentName = this.configService.get('agent.name') as string;
      const response = await fetch(`${this.baseUrl}/api/agents/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agentId: this.agentId,
          agentName: agentName || os.hostname(),
          hostname: os.hostname(),
          version: this.getVersion(),
          watchPaths,
          status: 'online',
        }),
      });

      if (response.ok) {
        console.log('Heartbeat recorded successfully');
      }
    } catch (e) {
      console.warn('Could not report agent heartbeat to API:', e);
    }
  }

  /**
   * Get all cinemas for this agent
   */
  async getCinemas(): Promise<CinemaFile[]> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(`${this.baseUrl}/api/cinemas?agentId=${this.agentId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.auth0Service.clearToken();
          return this.getCinemas();
        }
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return (await response.json()) as CinemaFile[];
    } catch (error) {
      console.error('Failed to get cinemas:', error);
      throw error;
    }
  }

  private getVersion(): string {
    return process.env.npm_package_version || '1.0.0';
  }
}