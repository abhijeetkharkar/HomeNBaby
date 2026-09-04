import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { MovieProcessor } from '../processors/movie-processor';
import { ConfigService } from '../config/config.service';

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
    private readonly configService: ConfigService
  ) {}

  /**
   * Start watching all configured directories for video file changes
   * @throws {Error} If unable to start file watching
   */
  async start(): Promise<void> {
    try {
      // Get watch paths from configuration
      this.watchPaths = this.configService.get('agent.watchPaths') as string[];
      
      for (const watchPath of this.watchPaths) {
        if (fs.existsSync(watchPath)) {
          await this.watchFolder(watchPath);
        } else {
          console.warn(`Watch path does not exist, skipping: ${watchPath}`);
        }
      }
      
      console.log(`Started watching ${this.watchers.length} folders`);
    } catch (error) {
      console.error('Failed to start file watcher:', error);
      throw error;
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
