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

/**
 * Processes movie files by extracting metadata and managing database operations
 */
export class MovieProcessor {
  private readonly qualityIndicators = ['720p', '1080p', '4K', 'BluRay', 'DVDRip', 'WEBRip', 'HDTV', 'BRRip'] as const;
  private readonly codecIndicators = ['x264', 'x265', 'H264', 'H265', 'HEVC', 'DivX', 'XviD'] as const;

  constructor(
    private readonly apiClient: CinemaManagerApiService,
    private readonly config: ConfigService
  ) {}

  /**
   * Process a newly detected movie file
   * @param filePath - Full path to the new movie file
   */
  async processNewFile(filePath: string): Promise<void> {
    try {
      console.log(`Processing new movie file: ${filePath}`);
      
      const metadata = await this.extractMetadata(filePath);
      
      // Check if file already exists in database
      const existingMovie = await this.apiClient.getCinemaByPath(filePath);
      if (existingMovie) {
        console.log(`Movie already exists in database: ${filePath}`);
        return;
      }

      // Save to database via API
      await this.apiClient.createCinema(metadata);
      console.log(`Successfully processed and saved: ${metadata.title}`);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  /**
   * Process a removed movie file by deleting it from the database
   * @param filePath - Full path to the removed movie file
   */
  async processRemovedFile(filePath: string): Promise<void> {
    try {
      console.log(`Processing removed movie file: ${filePath}`);
      
      const existingMovie = await this.apiClient.getCinemaByPath(filePath);
      if (existingMovie) {
        await this.apiClient.deleteCinema(existingMovie.id);
        console.log(`Removed movie from database: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error processing removed file ${filePath}:`, error);
      throw error; // Re-throw to allow caller to handle
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
    
    const metadata: MovieMetadata = {
      id: this.generateId(filePath),
      title,
      filePath,
      fileName,
      fileSize: stats.size,
      createdAt: stats.birthtime.toISOString(),
      lastModified: stats.mtime.toISOString(),
      format: path.extname(filePath).toLowerCase().substring(1),
    };

    // TODO: Use a library like ffprobe to extract video metadata (duration, resolution)
    // For now, we'll set basic metadata
    
    return metadata;
  }

  /**
   * Extract and clean movie title from filename
   * @param fileName - Original filename
   * @returns Cleaned movie title
   */
  private extractTitleFromFilename(fileName: string): string {
    // Remove file extension
    let title = path.parse(fileName).name;
    
    // Common patterns to clean up movie titles
    // Remove year in parentheses or brackets
    title = title.replace(/[[()]\d{4}[[\])]/g, '');
    
    // Remove quality indicators
    const qualityPattern = new RegExp(`\\b(${this.qualityIndicators.join('|')})\\b`, 'gi');
    title = title.replace(qualityPattern, '');
    
    // Remove codec info
    const codecPattern = new RegExp(`\\b(${this.codecIndicators.join('|')})\\b`, 'gi');
    title = title.replace(codecPattern, '');
    
    // Remove release group info (usually at the end in brackets or after dash)
    title = title.replace(/-[A-Z0-9]+$/gi, '');
    title = title.replace(/\[[A-Z0-9]+\]$/gi, '');
    
    // Replace dots, underscores, and multiple spaces with single space
    title = title.replace(/[._]/g, ' ');
    title = title.replace(/\s+/g, ' ');
    
    // Trim and capitalize
    title = title.trim();
    title = this.toTitleCase(title);
    
    return title || fileName; // Fallback to original filename if cleaning resulted in empty string
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
