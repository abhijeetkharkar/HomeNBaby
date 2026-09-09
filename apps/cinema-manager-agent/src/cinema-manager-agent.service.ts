import { FileWatcher } from './file-watcher/file-watcher';
import { MovieProcessor } from './processors/movie-processor';
import { CinemaManagerApiService } from './services/cinema-manager-api.service';
import { Auth0M2MService } from './auth/auth0-m2m.service';
import { ConfigService } from './config/config.service';
import { LocalServer } from './server/local-server';

/**
 * Main Windows service for Cinema Manager Agent
 * Monitors file system changes and synchronizes with API
 */
export class CinemaManagerAgentService {
  private fileWatcher?: FileWatcher;
  private movieProcessor?: MovieProcessor;
  private apiClient?: CinemaManagerApiService;
  private auth0Service?: Auth0M2MService;
  private config?: ConfigService;
  private localServer?: LocalServer;
  private heartbeatInterval?: NodeJS.Timeout;

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

      // Start local HTTP server for native video launching from web UI
      this.localServer = new LocalServer();
      this.localServer.start();

      // Initialize and start file watcher
      this.fileWatcher = new FileWatcher(this.movieProcessor, this.config, this.apiClient);
      await this.fileWatcher.start();
      
      console.log('Cinema Manager Agent Service started successfully');
      
      // Test API connectivity and send initial heartbeat
      await this.testApiConnection();
      await this.sendHeartbeat();

      // Schedule periodic heartbeat and lookup path sync every 60 seconds
      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat().catch((err) => console.warn('Heartbeat error:', err));
      }, 60000);

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
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this.localServer) {
      this.localServer.stop();
      this.localServer = undefined;
    }

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
   * Send heartbeat to backend API and sync lookup paths
   */
  private async sendHeartbeat(): Promise<void> {
    if (this.apiClient && this.fileWatcher) {
      try {
        const remoteLookupPaths = await this.apiClient.getLookupPaths();
        if (remoteLookupPaths && remoteLookupPaths.length > 0) {
          await this.fileWatcher.syncPaths(remoteLookupPaths.map((lp) => lp.path));
        }
      } catch (e) {
        // ignore sync error
      }

      const paths = this.fileWatcher.getWatchedPaths();
      await this.apiClient.sendHeartbeat(paths);
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
      
      const isConnected = await this.apiClient.testConnection();
      if (isConnected) {
        console.log('API connection test successful');
      } else {
        console.log('API connection test pending / unverified (agent running locally)');
      }
    } catch (error) {
      console.warn('API connection test notice:', error);
    }
  }

  /**
   * Get service health status
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