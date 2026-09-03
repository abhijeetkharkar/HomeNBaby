import { FileWatcher } from './file-watcher/file-watcher';
import { MovieProcessor } from './processors/movie-processor';
import { CinemaManagerApiService } from './services/cinema-manager-api.service';
import { Auth0M2MService } from './auth/auth0-m2m.service';
import { ConfigService } from './config/config.service';

/**
 * Main Windows service for Cinema Manager Agent
 * Monitors file system changes and synchronizes with BFF API
 */
export class CinemaManagerAgentService {
  private fileWatcher?: FileWatcher;
  private movieProcessor?: MovieProcessor;
  private apiClient?: CinemaManagerApiService;
  private auth0Service?: Auth0M2MService;
  private config?: ConfigService;

  /**
   * Initialize and start the cinema manager agent service
   */
  async start(): Promise<void> {
    try {
      console.log('Starting Cinema Manager Agent Service...');
      
      // Initialize configuration
      this.config = new ConfigService();
      console.log('Configuration loaded successfully');

      // Initialize Auth0 M2M service
      this.auth0Service = new Auth0M2MService(this.config);
      console.log('Auth0 M2M service initialized');

      // Initialize API client
      this.apiClient = new CinemaManagerApiService(this.auth0Service, this.config);
      console.log('API client initialized');

      // Initialize movie processor
      this.movieProcessor = new MovieProcessor(this.apiClient, this.config);
      console.log('Movie processor initialized');

      // Initialize and start file watcher
      this.fileWatcher = new FileWatcher(this.movieProcessor, this.config);
      await this.fileWatcher.start();
      
      console.log('Cinema Manager Agent Service started successfully');
      
      // Test API connectivity
      await this.testApiConnection();
      
    } catch (error) {
      console.error('Failed to start Cinema Manager Agent Service:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop the cinema manager agent service
   */
  async stop(): Promise<void> {
    console.log('Stopping Cinema Manager Agent Service...');
    
    try {
      if (this.fileWatcher) {
        await this.fileWatcher.stop();
        console.log('File watcher stopped');
      }
      
      console.log('Cinema Manager Agent Service stopped successfully');
    } catch (error) {
      console.error('Error during service shutdown:', error);
    }
  }

  /**
   * Test API connection to ensure service is properly configured
   */
  private async testApiConnection(): Promise<void> {
    try {
      if (!this.apiClient) {
        throw new Error('API client not initialized');
      }
      
      // Test authentication and API connectivity
      await this.apiClient.testConnection();
      console.log('API connection test successful');
      
    } catch (error) {
      console.error('API connection test failed:', error);
      throw new Error(`Cannot connect to Cinema Manager BFF API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get service health status
   * @returns Service health information
   */
  getHealthStatus(): { 
    status: 'healthy' | 'unhealthy';
    components: Record<string, boolean>;
    watchPaths?: string[];
  } {
    return {
      status: this.isHealthy() ? 'healthy' : 'unhealthy',
      components: {
        config: !!this.config,
        auth0Service: !!this.auth0Service,
        apiClient: !!this.apiClient,
        movieProcessor: !!this.movieProcessor,
        fileWatcher: !!this.fileWatcher?.isWatching()
      },
      watchPaths: this.fileWatcher?.getWatchedPaths() || []
    };
  }

  /**
   * Check if all service components are healthy
   * @returns True if service is healthy
   */
  private isHealthy(): boolean {
    return !!(
      this.config &&
      this.auth0Service &&
      this.apiClient &&
      this.movieProcessor &&
      this.fileWatcher?.isWatching()
    );
  }
}

// Service entry point for Windows service
if (require.main === module) {
  const service = new CinemaManagerAgentService();
  
  // Handle process signals for graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await service.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await service.stop();
    process.exit(0);
  });
  
  // Start the service
  service.start().catch((error) => {
    console.error('Service startup failed:', error);
    process.exit(1);
  });
}