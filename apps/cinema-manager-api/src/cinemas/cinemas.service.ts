import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { DynamoDbService } from '../dynamodb/dynamodb.service';
import { MetadataService } from '../metadata/metadata.service';
import { Cinema, CreateCinemaDto, CinemaFile } from '@cinema-manager/models';

@Injectable()
export class CinemasService {
  private readonly logger = new Logger(CinemasService.name);

  constructor(
    @Inject(DynamoDbService) private readonly dynamoDbService: DynamoDbService,
    @Inject(MetadataService) private readonly metadataService: MetadataService
  ) {}

  /**
   * Get all movies from DynamoDB
   */
  async getAll(): Promise<Cinema[]> {
    this.logger.log('Fetching all movies from DynamoDB');
    const items = await this.dynamoDbService.scan<any>(
      this.dynamoDbService.moviesTable
    );
    return items.map((item) => this.transformToCinema(item));
  }

  /**
   * Get a movie by ID
   */
  async getById(id: number | string): Promise<Cinema> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    const item = await this.dynamoDbService.getItem<any>(
      this.dynamoDbService.moviesTable,
      { id: isNaN(numId) ? id : numId }
    );

    if (!item) {
      throw new NotFoundException(`Movie with ID "${id}" not found`);
    }

    return this.transformToCinema(item);
  }

  /**
   * Find movie by file path
   */
  async getByPath(filePath: string, agentId?: string): Promise<Cinema | null> {
    const items = await this.dynamoDbService.scan<any>(
      this.dynamoDbService.moviesTable,
      {
        filterExpression: '#p = :pathVal',
        expressionAttributeNames: { '#p': 'path' },
        expressionAttributeValues: { ':pathVal': filePath },
      }
    );

    if (items.length > 0) {
      return this.transformToCinema(items[0]);
    }
    return null;
  }

  /**
   * Search movies by query string (matches title, actors, director, genre)
   */
  async search(query: string): Promise<Cinema[]> {
    const all = await this.getAll();
    if (!query || !query.trim()) {
      return all;
    }

    const q = query.toLowerCase().trim();
    return all.filter((movie) => {
      return (
        movie.title?.toLowerCase().includes(q) ||
        movie.genre?.toLowerCase().includes(q) ||
        movie.director?.toLowerCase().includes(q) ||
        movie.actors?.toLowerCase().includes(q) ||
        movie.plot?.toLowerCase().includes(q)
      );
    });
  }

  /**
   * Get movies by genre
   */
  async getByGenre(genre: string): Promise<Cinema[]> {
    const all = await this.getAll();
    const g = genre.toLowerCase().trim();
    return all.filter((movie) => movie.genre?.toLowerCase().includes(g));
  }

  /**
   * Ingest and enrich a movie file from the Agent with intelligent deduplication and quality upgrade
   */
  async createCinema(dto: CreateCinemaDto): Promise<Cinema> {
    this.logger.log(`Ingesting cinema file: "${dto.fileName}" (${dto.filePath})`);

    // 1. Check if exact path already exists
    const existing = await this.getByPath(dto.filePath, dto.agentId);
    if (existing) {
      this.logger.log(`Movie already exists for path: ${dto.filePath}`);
      return existing;
    }

    // 2. Extract year from filename if present (e.g., Movie.Title.2023.1080p.mkv)
    const yearMatch = dto.fileName.match(/\b(19\d\d|20\d\d)\b/);
    const parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    // 3. Fetch TMDB/OMDB enrichment with fallback
    let enriched: any = null;
    try {
      enriched = await this.metadataService.enrichMovie(
        dto.title || dto.fileName,
        parsedYear
      );
    } catch (e) {
      this.logger.warn(`Metadata enrichment failed for "${dto.fileName}", using basic metadata:`, e);
      enriched = {
        title: dto.title || dto.fileName,
        year: parsedYear || new Date().getFullYear(),
        type: 'movie',
        quality: '1080p',
      };
    }

    const parseSafeInt = (val: any, fallback = 0): number => {
      if (val === null || val === undefined || val === '') return fallback;
      const parsed = parseInt(String(val), 10);
      return isNaN(parsed) ? fallback : parsed;
    };

    const parseSafeFloat = (val: any, fallback = 0): number => {
      if (val === null || val === undefined || val === '') return fallback;
      const parsed = parseFloat(String(val));
      return isNaN(parsed) ? fallback : parsed;
    };

    const movieTitle = enriched.title || dto.title || dto.fileName;
    const movieYear = parseSafeInt(enriched.year, parseSafeInt(parsedYear, new Date().getFullYear()));
    const effectiveQuality = this.extractResolution(dto, enriched);
    const newQualityRank = this.getQualityRank(effectiveQuality, dto.fileName);
    const newFileSize = parseSafeInt(dto.fileSize, 0);
    const now = new Date().toISOString();

    // 4. Check for duplicate movie by IMDb ID, TMDb ID, or Title + Release Year
    const duplicateMovie = await this.findDuplicateMovie(
      enriched.imdbId,
      enriched.tmdbId,
      movieTitle,
      movieYear
    );

    if (duplicateMovie) {
      const existingQualityRank = this.getQualityRank(duplicateMovie.quality, duplicateMovie.fileName);
      const existingFileSize = duplicateMovie.fileSize || 0;

      // Upgrade existing movie record if incoming file is higher resolution or larger rip
      if (newQualityRank > existingQualityRank || (newQualityRank === existingQualityRank && newFileSize > existingFileSize)) {
        this.logger.log(
          `Upgrading existing movie "${duplicateMovie.title}" (ID: ${duplicateMovie.id}) from ${duplicateMovie.quality || 'Unknown'} to ${effectiveQuality} with file: ${dto.fileName}`
        );

        const updatedItem: any = {
          ...duplicateMovie,
          path: dto.filePath,
          fileName: dto.fileName,
          fileSize: newFileSize,
          quality: effectiveQuality,
          format: dto.format || duplicateMovie.format || '',
          lastUpdatedDate: now,
        };

        delete updatedItem.genres;
        delete updatedItem.languages;
        delete updatedItem.directors;
        delete updatedItem.actorsList;

        await this.dynamoDbService.putItem(this.dynamoDbService.moviesTable, updatedItem);
        return this.transformToCinema(updatedItem);
      } else {
        this.logger.log(
          `Skipping duplicate file for "${duplicateMovie.title}" (${effectiveQuality} <= existing ${duplicateMovie.quality}): ${dto.fileName}`
        );
        return duplicateMovie;
      }
    }

    const id = Date.now() + Math.floor(Math.random() * 10000);
    const genreVal = (enriched.genre && String(enriched.genre).trim()) ? String(enriched.genre).trim() : 'Unknown';

    const cinemaItem: any = {
      id: id,
      path: dto.filePath,
      fileName: dto.fileName,
      fileSize: newFileSize,
      agentId: dto.agentId || 'default',
      imdbId: enriched.imdbId || '',
      tmdbId: parseSafeInt(enriched.tmdbId, 0),
      type: enriched.type || 'movie',
      title: movieTitle,
      year: movieYear,
      releaseDate: enriched.releaseDate || '',
      rated: enriched.rated || '',
      runtime: parseSafeInt(enriched.runtime, parseSafeInt(dto.duration, 0)),
      genre: genreVal,
      plot: enriched.plot || '',
      imdbRating: parseSafeFloat(enriched.imdbRating, 0),
      imdbVotes: enriched.imdbVotes || '',
      metascore: parseSafeInt(enriched.metascore, 0),
      awards: enriched.awards || '',
      language: enriched.language || '',
      director: enriched.director || '',
      actors: enriched.actors || '',
      revenue: parseSafeInt(enriched.revenue, 0),
      poster: enriched.poster || '',
      quality: effectiveQuality,
      showCinema: 1,
      lastUpdatedDate: now,
      dateAdded: now,
      format: dto.format || '',
    };

    await this.dynamoDbService.putItem(
      this.dynamoDbService.moviesTable,
      cinemaItem
    );

    this.logger.log(`Saved cinema record "${cinemaItem.title}" with ID ${id} (${effectiveQuality})`);
    return this.transformToCinema(cinemaItem);
  }

  private async findDuplicateMovie(
    imdbId?: string,
    tmdbId?: number,
    title?: string,
    year?: number
  ): Promise<Cinema | null> {
    const allMovies = await this.getAll();
    for (const m of allMovies) {
      if (imdbId && m.imdbId && m.imdbId === imdbId) {
        return m;
      }
      if (tmdbId && m.tmdbId && m.tmdbId === tmdbId && tmdbId > 0) {
        return m;
      }
      if (
        title &&
        m.title &&
        m.title.toLowerCase().trim() === title.toLowerCase().trim() &&
        year &&
        m.year &&
        m.year === year
      ) {
        return m;
      }
    }
    return null;
  }

  private getQualityRank(quality?: string, fileName?: string): number {
    const q = (quality || fileName || '').toLowerCase();
    if (q.includes('4k') || q.includes('2160p') || q.includes('uhd')) return 4;
    if (q.includes('1080p') || q.includes('fhd')) return 3;
    if (q.includes('720p') || q.includes('hd')) return 2;
    if (q.includes('480p') || q.includes('sd') || q.includes('dvdrip')) return 1;
    return 2;
  }

  private extractResolution(dto: CreateCinemaDto, enriched: any): string {
    if (dto.resolution && dto.resolution !== '1080p') return dto.resolution;
    const fromFile = dto.fileName.toLowerCase();
    if (/\b(4k|2160p|uhd)\b/i.test(fromFile)) return '4K';
    if (/\b(1080p|fhd)\b/i.test(fromFile)) return '1080p';
    if (/\b(720p|hd)\b/i.test(fromFile)) return '720p';
    if (/\b(480p|sd|dvdrip)\b/i.test(fromFile)) return '480p';
    return dto.resolution || enriched.quality || '1080p';
  }

  /**
   * Delete a movie by ID
   */
  async deleteCinema(id: number | string): Promise<void> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    await this.dynamoDbService.deleteItem(this.dynamoDbService.moviesTable, {
      id: isNaN(numId) ? id : numId,
    });
    this.logger.log(`Deleted cinema with ID ${id}`);
  }

  /**
   * Transform raw database item into a full Cinema model with helper arrays
   */
  private transformToCinema(item: any): Cinema {
    const genres = item.genre
      ? item.genre.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const languages = item.language
      ? item.language.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const directors = item.director
      ? item.director.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    const actorsList = item.actors
      ? item.actors.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    return {
      ...item,
      id: item.id,
      path: item.path,
      imdbId: item.imdbId || '',
      tmdbId: item.tmdbId || 0,
      type: item.type || 'movie',
      title: item.title || '',
      year: item.year || 0,
      releaseDate: item.releaseDate || '',
      rated: item.rated || '',
      runtime: item.runtime || 0,
      genre: item.genre || '',
      plot: item.plot || '',
      imdbRating: item.imdbRating || 0,
      imdbVotes: item.imdbVotes || '',
      metascore: item.metascore || 0,
      awards: item.awards || '',
      language: item.language || '',
      director: item.director || '',
      actors: item.actors || '',
      revenue: item.revenue || 0,
      poster: item.poster || '',
      quality: item.quality || '1080p',
      showCinema: item.showCinema ?? 1,
      lastUpdatedDate: item.lastUpdatedDate || '',
      genres,
      languages,
      directors,
      actorsList,
    };
  }
}
