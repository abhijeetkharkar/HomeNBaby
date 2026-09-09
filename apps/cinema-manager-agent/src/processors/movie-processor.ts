import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { CinemaManagerApiService } from '../services/cinema-manager-api.service';
import { ConfigService } from '../config/config.service';

export interface MovieMetadata {
  id: string;
  title: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
  lastModified: string;
  format: string;
  duration?: number;
  resolution?: string;
}

interface QueueItem {
  action: 'add' | 'remove';
  filePath: string;
}

/**
 * Processes movie files by extracting metadata and managing database operations
 */
export class MovieProcessor {
  private readonly qualityIndicators = ['720p', '1080p', '4K', 'BluRay', 'DVDRip', 'WEBRip', 'HDTV', 'BRRip'] as const;
  private readonly codecIndicators = ['x264', 'x265', 'H264', 'H265', 'HEVC', 'DivX', 'XviD'] as const;

  private queue: QueueItem[] = [];
  private isProcessing = false;
  private processedCount = 0;

  constructor(
    private readonly apiClient: CinemaManagerApiService,
    private readonly config: ConfigService
  ) {}

  /**
   * Enqueue a newly detected movie file for sequential processing
   */
  async processNewFile(filePath: string): Promise<void> {
    if (!this.queue.some((item) => item.filePath === filePath && item.action === 'add')) {
      this.queue.push({ action: 'add', filePath });
      this.triggerQueue();
    }
  }

  /**
   * Enqueue a removed movie file for sequential processing
   */
  async processRemovedFile(filePath: string): Promise<void> {
    this.queue.push({ action: 'remove', filePath });
    this.triggerQueue();
  }

  private triggerQueue(): void {
    if (!this.isProcessing) {
      this.processQueue().catch((err) => console.error('Queue processing error:', err));
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        if (item.action === 'add') {
          await this.handleAddFile(item.filePath);
        } else if (item.action === 'remove') {
          await this.handleRemoveFile(item.filePath);
        }
      } catch (error) {
        console.error(`Error processing file ${item.filePath}:`, error);
      }

      this.processedCount++;
      // 350ms pause between movies ensures full compliance with TMDB/OMDB per-second rate limits
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    this.isProcessing = false;
  }

  private async handleAddFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const metadata = await this.extractMetadata(filePath);
    const existingMovie = await this.apiClient.getCinemaByPath(filePath);
    if (existingMovie) {
      return;
    }

    console.log(`[Queue ${this.queue.length} left] Ingesting: ${metadata.title} (${path.basename(filePath)})`);
    try {
      await this.apiClient.createCinema(metadata);
      console.log(`[Saved ✓] ${metadata.title}`);
    } catch (apiErr) {
      console.warn(`[Retry Notice] Ingestion error on ${metadata.title}:`, apiErr);
    }
  }

  private async handleRemoveFile(filePath: string): Promise<void> {
    const existingMovie = await this.apiClient.getCinemaByPath(filePath);
    if (existingMovie) {
      await this.apiClient.deleteCinema(existingMovie.id);
      console.log(`Removed movie from database: ${filePath}`);
    }
  }

  /**
   * Extract metadata from a movie file
   * @param filePath - Path to the movie file
   * @returns Promise resolving to movie metadata
   * @throws {Error} If file cannot be accessed or read
   */
  private async extractMetadata(filePath: string): Promise<MovieMetadata> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);
    
    // Extract movie title from filename (remove extension and clean up)
    const title = this.extractTitleFromFilename(fileName);
    const resolution = this.extractResolutionFromFilename(fileName);
    
    const metadata: MovieMetadata = {
      id: this.generateId(filePath),
      title,
      filePath,
      fileName,
      fileSize: stats.size,
      createdAt: stats.birthtime.toISOString(),
      lastModified: stats.mtime.toISOString(),
      format: path.extname(filePath).toLowerCase().substring(1),
      resolution,
    };

    return metadata;
  }

  /**
   * Extract video resolution indicator from filename
   */
  private extractResolutionFromFilename(fileName: string): string {
    if (/\b(4k|2160p|uhd)\b/i.test(fileName)) return '4K';
    if (/\b(1080p|fhd)\b/i.test(fileName)) return '1080p';
    if (/\b(720p|hd)\b/i.test(fileName)) return '720p';
    if (/\b(480p|sd|dvdrip)\b/i.test(fileName)) return '480p';
    return '1080p';
  }

  /**
   * Extract and clean movie title from filename
   * @param fileName - Original filename
   * @returns Cleaned movie title
   */
  private extractTitleFromFilename(fileName: string): string {
    const base = path.parse(fileName).name;

    // Detect 4-digit release year (1900 - 2099) preceded/followed by delimiters
    const yearMatch = base.match(/[\s._([{-](19\d\d|20\d\d)[\s._)\]}-]/);
    let rawTitle = base;

    if (yearMatch && yearMatch.index !== undefined) {
      // Everything before the release year is the movie title
      rawTitle = base.substring(0, yearMatch.index);
    }

    // Replace dots, underscores, dashes with space
    let clean = rawTitle.replace(/[._]/g, ' ');

    // Strip quality, size, codecs, audio, and release group tags if present before year
    clean = clean.replace(/\b(\d+mb|\d+(\.\d+)?gb|1080p|720p|480p|4k|2160p|bluray|bdrip|brrip|hdrip|web-dl|webrip|dvdrip|x264|x265|hevc|h264|aac\d*|ac3|dd5\.1|yify|yts(\.lt|\.mx)?|rarbg|mkvcage\d*|mkvchge|mkvcge|shaanig|evo|tigole|stylish(salh| release)?|sujaidr|scorp|kickass|exd|ipt|axxo|extended|remastered)\b/gi, '');

    // Strip brackets, braces, parentheses content
    clean = clean.replace(/\[[^\]]*\]/g, '');
    clean = clean.replace(/\([^)]*\)/g, '');
    clean = clean.replace(/\{[^}]*\}/g, '');
    clean = clean.replace(/[-_=+()]+/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();

    if (!clean) {
      clean = base;
    }

    return this.toTitleCase(clean);
  }

  /**
   * Convert string to title case
   * @param str - Input string
   * @returns String in title case
   */
  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  }

  /**
   * Generate a unique, consistent ID based on file path
   * @param filePath - Full file path
   * @returns MD5 hash of the file path
   */
  private generateId(filePath: string): string {
    // Generate a consistent ID based on file path
    return crypto.createHash('md5').update(filePath).digest('hex');
  }
}
