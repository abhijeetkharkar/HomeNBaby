import * as readline from 'readline';
import * as os from 'os';
import { FileWatcher } from './file-watcher/file-watcher';
import { MovieProcessor } from './processors/movie-processor';
import { CinemaManagerApiService } from './services/cinema-manager-api.service';
import { Auth0M2MService } from './auth/auth0-m2m.service';
import { ConfigService } from './config/config.service';
import { CredentialsService } from './vault/credentials.service';
import { LocalServer } from './server/local-server';

/**
 * Main service for Cinema Manager Desktop Agent
 * Monitors file system changes and synchronizes with Cinema Manager API
 */
export class CinemaManagerAgentService {
  private fileWatcher?: FileWatcher;
  private movieProcessor?: MovieProcessor;
  private apiClient?: CinemaManagerApiService;
  private auth0Service?: Auth0M2MService;
  private credentials?: CredentialsService;
  private config?: ConfigService;
  private localServer?: LocalServer;
  private heartbeatInterval?: NodeJS.Timeout;
  private keepAliveTimer?: NodeJS.Timeout;

  /**
   * Initialize and start the cinema manager agent service
   */
  async start(): Promise<void> {
    try {
      console.log('Starting Cinema Manager Agent Service...');

      // Keep Node process event loop alive indefinitely
      this.keepAliveTimer = setInterval(() => {}, 60000);

      // Initialize credentials vault and configuration
      this.credentials = new CredentialsService();
      this.config = new ConfigService();
      this.auth0Service = new Auth0M2MService(this.config);

      const agentId = (this.config.get('agent.id') as string) || os.hostname();
      const agentName =
        (this.config.get('agent.name') as string) || `Cinema Agent - ${os.hostname()}`;

      // Start local HTTP server immediately so browser UI can communicate and auto-pair
      this.localServer = new LocalServer({
        getWatchPaths: () => this.fileWatcher?.getWatchedPaths() || [],
        getAgentId: () =>
          this.credentials?.getDeviceId() ||
          (this.config?.get('agent.id') as string) ||
          os.hostname(),
        agentId,
        agentName,
        isPaired: () => this.credentials?.isPaired() || false,
        onPair: async (code, watchPaths) => this.pairWithCode(code, watchPaths),
        onUpdatePaths: async (watchPaths) => this.updateWatchPaths(watchPaths),
      });
      this.localServer.start();

      console.log('Cinema Manager Local Server listening on http://127.0.0.1:3334');

      // If already paired from a previous session, start monitoring engine immediately
      if (this.credentials.isPaired()) {
        console.log('Linked account found in local vault. Starting media engine...');
        const creds = this.credentials.getCredentials();
        const paths =
          creds?.watchPaths && creds.watchPaths.length > 0
            ? creds.watchPaths
            : (this.config.get('agent.watchPaths') as string[]) || [];
        await this.initializeEngine(paths);
      } else {
        console.log('======================================================');
        console.log('  Cinema Manager Desktop Companion Agent Running      ');
        console.log('======================================================');
        console.log('Status: Ready for pairing');
        console.log('Open https://cinema.abhijeetkharkar.com in your browser.');
        console.log('The onboarding wizard will pair this device automatically.');
        console.log('======================================================\n');

        if (process.stdin.isTTY && !process.env.CI) {
          this.listenTerminalPairing();
        }
      }

      console.log('Cinema Manager Agent Service started successfully');
    } catch (error) {
      console.error('Failed to start Cinema Manager Agent Service:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Initialize media processing and watching engine once paired
   */
  private async initializeEngine(watchPaths?: string[]): Promise<void> {
    try {
      this.apiClient = new CinemaManagerApiService(
        this.auth0Service!,
        this.config!,
        this.credentials
      );
      this.movieProcessor = new MovieProcessor(this.apiClient, this.config!);

      if (!this.fileWatcher) {
        this.fileWatcher = new FileWatcher(this.movieProcessor, this.config!, this.apiClient);
        await this.fileWatcher.start();
      }

      if (watchPaths && watchPaths.length > 0) {
        await this.fileWatcher.syncPaths(watchPaths);
      }

      await this.testApiConnection();
      await this.sendHeartbeat();

      if (!this.heartbeatInterval) {
        this.heartbeatInterval = setInterval(() => {
          this.sendHeartbeat().catch((err) => console.warn('Heartbeat error:', err));
        }, 60000);
      }

      console.log('Cinema Manager Agent media engine active and monitoring files.');
    } catch (err: any) {
      console.error('Failed to initialize agent media engine:', err.message);
    }
  }

  /**
   * Direct pairing method callable by HTTP server or terminal prompt
   */
  public async pairWithCode(
    code: string,
    watchPaths?: string[]
  ): Promise<{ deviceId: string; agentName: string; watchPaths: string[] }> {
    console.log(`[AgentService] Pairing device with code "${code}"...`);
    const tempApiClient = new CinemaManagerApiService(this.auth0Service!, this.config!);
    const deviceName = (this.config?.get('agent.name') as string) || os.hostname();
    const res = await tempApiClient.pairWithCode(code, deviceName);

    const effectivePaths =
      watchPaths && watchPaths.length > 0
        ? watchPaths
        : res.watchPaths && res.watchPaths.length > 0
        ? res.watchPaths
        : (this.config?.get('agent.watchPaths') as string[]) || [];

    this.credentials?.saveCredentials({
      agentToken: res.agentToken,
      deviceId: res.deviceId,
      deviceName,
      pairedAt: new Date().toISOString(),
      watchPaths: effectivePaths,
    });

    console.log('[AgentService] Device successfully paired and credentials securely stored in local vault.');

    // Initialize media engine
    await this.initializeEngine(effectivePaths);

    return {
      deviceId: res.deviceId,
      agentName: deviceName,
      watchPaths: effectivePaths,
    };
  }

  /**
   * Update watched media directories dynamically
   */
  public async updateWatchPaths(paths: string[]): Promise<void> {
    console.log('[AgentService] Updating watched directories:', paths);
    if (this.fileWatcher) {
      await this.fileWatcher.syncPaths(paths);
    }

    if (this.credentials?.isPaired()) {
      const creds = this.credentials.getCredentials();
      if (creds) {
        this.credentials.saveCredentials({
          ...creds,
          watchPaths: paths,
        });
      }
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

    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
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
        return;
      }

      const isConnected = await this.apiClient.testConnection();
      if (isConnected) {
        console.log('API connection verified');
      } else {
        console.log('API connection test pending / local mode');
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
        fileWatcher: !!this.fileWatcher?.isWatching(),
      },
      watchPaths: this.fileWatcher?.getWatchedPaths() || [],
    };
  }

  /**
   * Optional terminal prompt for manual/fallback pairing
   */
  private listenTerminalPairing(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('Or enter Pairing Code here: ', async (answer) => {
      const code = answer.trim();
      if (code && !this.credentials?.isPaired()) {
        try {
          await this.pairWithCode(code);
          console.log('Device successfully paired from terminal!\n');
        } catch (err: any) {
          console.error('Pairing failed:', err.message);
        }
      }
      rl.close();
    });
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
