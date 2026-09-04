// Use native fetch (Node.js 18+) or require node-fetch for older versions
const fetch = globalThis.fetch || require('node-fetch');
import { Auth0M2MService } from '../auth/auth0-m2m.service';
import { ConfigService } from '../config/config.service';
import { CreateCinemaDto, CinemaFile, VideoFile } from '@cinema-manager/models';

/**
 * API client service for communicating with the Cinema Manager API
 * Uses Auth0 machine-to-machine authentication
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

  /**
   * Upload cinema data to BFF API
   * @param cinema - Cinema data to upload
   * @returns Promise resolving to created cinema
   */
  async createCinema(cinema: Omit<CreateCinemaDto, 'agentId'>): Promise<CinemaFile> {
    try {
      const token = await this.auth0Service.getAccessToken();
      
      const cinemaData: CreateCinemaDto = {
        ...cinema,
        agentId: this.agentId
      };

      const response = await fetch(`${this.baseUrl}/api/cinemas`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': `CinemaManagerAgent/${this.getVersion()}`
        },
        body: JSON.stringify(cinemaData)
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token might be invalid, clear cache and retry once
          this.auth0Service.clearToken();
          return this.createCinema(cinema);
        }
        
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as CinemaFile;
    } catch (error) {
      console.error('Failed to create cinema:', error);
      throw error;
    }
  }

  /**
   * Get cinema by file path
   * @param filePath - File path to search for
   * @returns Promise resolving to cinema or null if not found
   */
  async getCinemaByPath(filePath: string): Promise<CinemaFile | null> {
    try {
      const token = await this.auth0Service.getAccessToken();
      
      const encodedPath = encodeURIComponent(filePath);
      const response = await fetch(`${this.baseUrl}/api/cinemas/by-path?filePath=${encodedPath}&agentId=${this.agentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': `CinemaManagerAgent/${this.getVersion()}`
        }
      });

      if (response.status === 404) {
        return null; // Cinema not found
      }

      if (!response.ok) {
        if (response.status === 401) {
          this.auth0Service.clearToken();
          return this.getCinemaByPath(filePath);
        }
        
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as CinemaFile;
    } catch (error) {
      console.error('Failed to get cinema by path:', error);
      throw error;
    }
  }

  /**
   * Delete cinema from BFF API
   * @param cinemaId - ID of cinema to delete
   */
  async deleteCinema(cinemaId: string): Promise<void> {
    try {
      const token = await this.auth0Service.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/api/cinemas/${cinemaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': `CinemaManagerAgent/${this.getVersion()}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.auth0Service.clearToken();
          return this.deleteCinema(cinemaId);
        }
        
        if (response.status === 404) {
          console.warn(`Cinema not found for deletion: ${cinemaId}`);
          return; // Already deleted, no error
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
   * @returns Promise resolving to true if connection successful
   */
  async testConnection(): Promise<boolean> {
    try {
      const token = await this.auth0Service.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': `CinemaManagerAgent/${this.getVersion()}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }

  /**
   * Get all cinemas for this agent
   * @returns Promise resolving to array of cinemas
   */
  async getCinemas(): Promise<CinemaFile[]> {
    try {
      const token = await this.auth0Service.getAccessToken();
      
      const response = await fetch(`${this.baseUrl}/api/cinemas?agentId=${this.agentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': `CinemaManagerAgent/${this.getVersion()}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.auth0Service.clearToken();
          return this.getCinemas();
        }
        
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as CinemaFile[];
    } catch (error) {
      console.error('Failed to get cinemas:', error);
      throw error;
    }
  }

  private getVersion(): string {
    return process.env.npm_package_version || '1.0.0';
  }
}