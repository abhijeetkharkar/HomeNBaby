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
   * Ingest and enrich a movie file from the Agent
   */
  async createCinema(dto: CreateCinemaDto): Promise<Cinema> {
    this.logger.log(`Ingesting cinema file: "${dto.fileName}" (${dto.filePath})`);

    // Check if already exists
    const existing = await this.getByPath(dto.filePath, dto.agentId);
    if (existing) {
      this.logger.log(`Movie already exists for path: ${dto.filePath}`);
      return existing;
    }

    // Extract year from filename if present (e.g., Movie.Title.2023.1080p.mkv)
    const yearMatch = dto.fileName.match(/\b(19\d\d|20\d\d)\b/);
    const parsedYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    // Fetch TMDB/OMDB enrichment
    const enriched = await this.metadataService.enrichMovie(
      dto.title || dto.fileName,
      parsedYear
    );

    const id = Date.now();
    const now = new Date().toISOString();

    const cinemaItem: any = {
      id: id,
      path: dto.filePath,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      agentId: dto.agentId,
      imdbId: enriched.imdbId || '',
      tmdbId: enriched.tmdbId || 0,
      type: enriched.type || 'movie',
      title: enriched.title || dto.title || dto.fileName,
      year: enriched.year || parsedYear || new Date().getFullYear(),
      releaseDate: enriched.releaseDate || '',
      rated: enriched.rated || '',
      runtime: enriched.runtime || dto.duration || 0,
      genre: enriched.genre || '',
      plot: enriched.plot || '',
      imdbRating: enriched.imdbRating || 0,
      imdbVotes: enriched.imdbVotes || '',
      metascore: enriched.metascore || 0,
      awards: enriched.awards || '',
      language: enriched.language || '',
      director: enriched.director || '',
      actors: enriched.actors || '',
      revenue: enriched.revenue || 0,
      poster: enriched.poster || '',
      quality: dto.resolution || enriched.quality || '1080p',
      showCinema: 1,
      lastUpdatedDate: now,
      dateAdded: now,
      format: dto.format || '',
    };

    await this.dynamoDbService.putItem(
      this.dynamoDbService.moviesTable,
      cinemaItem
    );

    this.logger.log(`Saved cinema record "${cinemaItem.title}" with ID ${id}`);
    return this.transformToCinema(cinemaItem);
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
