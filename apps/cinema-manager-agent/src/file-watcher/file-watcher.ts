import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { MovieProcessor } from '../processors/movie-processor';
import { ConfigService } from '../config/config.service';
import { CinemaManagerApiService } from '../services/cinema-manager-api.service';

/**
 * File watcher service that monitors directories for video files and processes them
 * when they are added, changed, or removed.
 * 
 * Supports common video formats: mp4, mkv, avi, mov, wmv, flv, webm, m4v
 */
export class FileWatcher {
  private watchers: chokidar.FSWatcher[] = [];
  private watchPaths: string[] = [];
  private readonly supportedVideoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'] as const;
  private readonly minimumFileSizeBytes = 100 * 1024 * 1024; // 100MB

  constructor(
    private readonly movieProcessor: MovieProcessor,
    private readonly configService: ConfigService,
    private readonly apiClient?: CinemaManagerApiService
  ) {}

  /**
   * Start watching all configured directories for video file changes
   * @throws {Error} If unable to start file watching
   */
  async start(): Promise<void> {
    try {
      // 1. Get local watch paths from configuration
      const localPaths: string[] = (this.configService.get('agent.watchPaths') as string[]) || [];

      // 2. Fetch remote lookup paths from central API
      let remotePaths: string[] = [];
      if (this.apiClient) {
        try {
          const apiLookupPaths = await this.apiClient.getLookupPaths();
          remotePaths = apiLookupPaths.map((lp) => lp.path);
          if (remotePaths.length > 0) {
            console.log(`Fetched ${remotePaths.length} lookup path(s) from central API`);
          }
        } catch (e) {
          console.warn('Failed to fetch lookup paths from API, using local paths:', e);
        }
      }

      // 3. Deduplicate all paths
      const allPaths = Array.from(new Set([...localPaths, ...remotePaths]));
      this.watchPaths = [];

      for (const watchPath of allPaths) {
        if (fs.existsSync(watchPath)) {
          await this.watchFolder(watchPath);
          this.watchPaths.push(watchPath);
        } else {
          console.warn(`Watch path does not exist on this machine, skipping: ${watchPath}`);
        }
      }
      
      console.log(`Started watching ${this.watchers.length} folders: ${this.watchPaths.join(', ')}`);
    } catch (error) {
      console.error('Failed to start file watcher:', error);
      throw error;
    }
  }

  /**
   * Dynamically sync watched paths (called periodically on heartbeat)
   */
  async syncPaths(paths: string[]): Promise<void> {
    for (const p of paths) {
      if (!this.watchPaths.includes(p)) {
        if (fs.existsSync(p)) {
          console.log(`Discovered new lookup path dynamically: ${p}`);
          await this.watchFolder(p);
          this.watchPaths.push(p);
        } else {
          console.warn(`Discovered lookup path does not exist on this machine: ${p}`);
        }
      }
    }
  }

  /**
   * Stop all file watchers and clean up resources
   * @throws {Error} If unable to stop file watchers properly
   */
  async stop(): Promise<void> {
    try {
      for (const watcher of this.watchers) {
        await watcher.close();
      }
      this.watchers = [];
      this.watchPaths = [];
      console.log('Stopped all file watchers');
    } catch (error) {
      console.error('Error stopping file watchers:', error);
      throw error;
    }
  }

  /**
   * Check if file watcher is currently watching any paths
   * @returns True if watching paths
   */
  isWatching(): boolean {
    return this.watchers.length > 0;
  }

  /**
   * Get currently watched paths
   * @returns Array of watched paths
   */
  getWatchedPaths(): string[] {
    return [...this.watchPaths];
  }

  private async watchFolder(folderPath: string) {
    const watcher = chokidar.watch(folderPath, {
      ignored: /(^|[/\\])\../, // ignore dotfiles
      persistent: true,
      depth: 10,
    });

    watcher
      .on('add', (filePath) => this.handleFileAdded(filePath))
      .on('change', (filePath) => this.handleFileChanged(filePath))
      .on('unlink', (filePath) => this.handleFileRemoved(filePath))
      .on('error', (error) => console.error(`Watcher error for ${folderPath}:`, error));

    this.watchers.push(watcher);
    console.log(`Started watching: ${folderPath}`);
  }

  private async handleFileAdded(filePath: string): Promise<void> {
    try {
      if (this.isVideoFile(filePath) && this.isNewFile(filePath)) {
        console.log(`New video file detected: ${filePath}`);
        await this.movieProcessor.processNewFile(filePath);
      }
    } catch (error) {
      console.error(`Error processing new file ${filePath}:`, error);
    }
  }

  private async handleFileChanged(filePath: string): Promise<void> {
    try {
      if (this.isVideoFile(filePath)) {
        console.log(`Video file changed: ${filePath}`);
        // Optionally handle file changes - could update metadata if file was modified
      }
    } catch (error) {
      console.error(`Error handling file change ${filePath}:`, error);
    }
  }

  private async handleFileRemoved(filePath: string): Promise<void> {
    try {
      if (this.isVideoFile(filePath)) {
        console.log(`Video file removed: ${filePath}`);
        await this.movieProcessor.processRemovedFile(filePath);
      }
    } catch (error) {
      console.error(`Error processing removed file ${filePath}:`, error);
    }
  }

  private isVideoFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return (this.supportedVideoExtensions as readonly string[]).includes(ext);
  }

  private isNewFile(filePath: string): boolean {
    // Simple heuristic: file should be larger than minimum size to be considered a movie
    // This helps avoid processing partial downloads
    try {
      const stats = fs.statSync(filePath);
      return stats.size > this.minimumFileSizeBytes;
    } catch {
      return false;
    }
  }


}
