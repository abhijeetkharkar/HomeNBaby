import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface EnrichedMetadata {
  imdbId?: string;
  tmdbId?: number;
  type: string;
  title: string;
  year?: number;
  releaseDate?: string;
  rated?: string;
  runtime?: number;
  genre?: string;
  plot?: string;
  imdbRating?: number;
  imdbVotes?: string;
  metascore?: number;
  awards?: string;
  language?: string;
  director?: string;
  actors?: string;
  revenue?: number;
  poster?: string;
  quality?: string;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  private readonly tmdbBaseUrl =
    process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
  private readonly tmdbApiKey = process.env.TMDB_API_KEY || '';
  private readonly omdbBaseUrl =
    process.env.OMDB_BASE_URL || 'https://www.omdbapi.com/';
  private readonly omdbApiKey = process.env.OMDB_API_KEY || '';

  /**
   * Enrich movie with metadata from TMDB and OMDB APIs
   * @param searchString - Movie title
   * @param year - Optional release year
   * @returns Enriched metadata or fallback object
   */
  async enrichMovie(searchString: string, year?: number): Promise<EnrichedMetadata> {
    const cleanedTitle = this.cleanTitle(searchString);
    this.logger.log(`Enriching movie: "${cleanedTitle}" (Year: ${year || 'unknown'})`);

    if (!this.tmdbApiKey && !this.omdbApiKey) {
      this.logger.warn(
        'TMDB_API_KEY and OMDB_API_KEY are not configured. Using fallback metadata.'
      );
      return this.createFallbackMetadata(cleanedTitle, year);
    }

    try {
      // 1. Search TMDB
      const tmdbParams: Record<string, string> = {
        api_key: this.tmdbApiKey,
        page: '1',
        include_adult: 'true',
        query: cleanedTitle,
      };
      if (year && !isNaN(year)) {
        tmdbParams['year'] = String(year);
      }

      const tmdbSearchRes = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
        params: tmdbParams,
        timeout: 5000,
      });

      const tmdbResults = tmdbSearchRes.data?.results;
      if (!tmdbResults || tmdbResults.length === 0) {
        this.logger.warn(`No TMDB results found for "${cleanedTitle}"`);
        return this.createFallbackMetadata(cleanedTitle, year);
      }

      const tmdbMovie = tmdbResults[0];
      const tmdbId = tmdbMovie.id;

      // 2. Get TMDB Movie Details
      let imdbId = '';
      let spokenLanguages: string[] = [];
      let runtime = 0;
      let revenue = 0;
      let releaseDate = tmdbMovie.release_date || '';

      try {
        const tmdbDetailRes = await axios.get(
          `${this.tmdbBaseUrl}/movie/${tmdbId}?api_key=${this.tmdbApiKey}`,
          { timeout: 5000 }
        );
        const detail = tmdbDetailRes.data;
        imdbId = detail.imdb_id || '';
        runtime = detail.runtime || 0;
        revenue = detail.revenue || 0;
        releaseDate = detail.release_date || releaseDate;
        if (Array.isArray(detail.spoken_languages)) {
          spokenLanguages = detail.spoken_languages
            .map((l: { english_name?: string; name?: string }) => l.english_name || l.name || '')
            .filter(Boolean);
        }
      } catch (detailError) {
        this.logger.warn(`Failed to fetch TMDB details for ID ${tmdbId}:`, detailError);
      }

      // 3. Query OMDB with IMDb ID or fallback to title search
      let omdbData: any = null;
      if (imdbId) {
        try {
          const omdbRes = await axios.get(this.omdbBaseUrl, {
            params: {
              apikey: this.omdbApiKey,
              i: imdbId,
              type: 'movie',
              plot: 'full',
            },
            timeout: 5000,
          });
          if (omdbRes.data?.Response !== 'False') {
            omdbData = omdbRes.data;
          }
        } catch (omdbErr) {
          this.logger.warn(`OMDB lookup by IMDb ID ${imdbId} failed:`, omdbErr);
        }
      }

      if (!omdbData) {
        try {
          const omdbRes = await axios.get(this.omdbBaseUrl, {
            params: {
              apikey: this.omdbApiKey,
              t: cleanedTitle,
              y: year ? String(year) : undefined,
              type: 'movie',
              plot: 'full',
            },
            timeout: 5000,
          });
          if (omdbRes.data?.Response !== 'False') {
            omdbData = omdbRes.data;
          }
        } catch (omdbErr) {
          this.logger.warn(`OMDB lookup by title "${cleanedTitle}" failed:`, omdbErr);
        }
      }

      const releaseYear =
        year ||
        (omdbData?.Year ? parseInt(omdbData.Year, 10) : undefined) ||
        (releaseDate ? parseInt(releaseDate.substring(0, 4), 10) : undefined) ||
        new Date().getFullYear();

      const posterPath = tmdbMovie.poster_path
        ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
        : omdbData?.Poster && omdbData.Poster !== 'N/A'
        ? omdbData.Poster
        : '';

      return {
        imdbId: imdbId || omdbData?.imdbID || '',
        tmdbId: tmdbId,
        type: omdbData?.Type || 'movie',
        title: omdbData?.Title || tmdbMovie.title || cleanedTitle,
        year: releaseYear,
        releaseDate: releaseDate || omdbData?.Released || '',
        rated: omdbData?.Rated !== 'N/A' ? omdbData?.Rated || '' : '',
        runtime: runtime || (omdbData?.Runtime ? parseInt(omdbData.Runtime, 10) : 0),
        genre: omdbData?.Genre !== 'N/A' ? omdbData?.Genre || '' : '',
        plot: omdbData?.Plot !== 'N/A' ? omdbData?.Plot || tmdbMovie.overview || '' : tmdbMovie.overview || '',
        imdbRating: omdbData?.imdbRating && omdbData.imdbRating !== 'N/A' ? parseFloat(omdbData.imdbRating) : tmdbMovie.vote_average || 0,
        imdbVotes: omdbData?.imdbVotes !== 'N/A' ? omdbData?.imdbVotes || '' : '',
        metascore: omdbData?.Metascore && omdbData.Metascore !== 'N/A' ? parseInt(omdbData.Metascore, 10) : 0,
        awards: omdbData?.Awards !== 'N/A' ? omdbData?.Awards || '' : '',
        language: spokenLanguages.join(', ') || (omdbData?.Language !== 'N/A' ? omdbData?.Language || '' : ''),
        director: omdbData?.Director !== 'N/A' ? omdbData?.Director || '' : '',
        actors: omdbData?.Actors !== 'N/A' ? omdbData?.Actors || '' : '',
        revenue: revenue,
        poster: posterPath,
        quality: '1080p',
      };
    } catch (err) {
      this.logger.error(`Error enriching metadata for "${cleanedTitle}":`, err);
      return this.createFallbackMetadata(cleanedTitle, year);
    }
  }

  private cleanTitle(title: string): string {
    let clean = title.replace(/[._]/g, ' ');
    // Remove year in parens/brackets
    clean = clean.replace(/[[()]\d{4}[[\])]/g, '');
    // Remove quality and resolution tags
    clean = clean.replace(/\b(1080p|720p|4k|2160p|bluray|bdrip|brrip|web-dl|webrip|dvdrip|x264|x265|hevc|h264|aac|ac3)\b/gi, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean || title;
  }

  private createFallbackMetadata(title: string, year?: number): EnrichedMetadata {
    return {
      type: 'movie',
      title: title,
      year: year || new Date().getFullYear(),
      plot: '',
      genre: '',
      language: '',
      director: '',
      actors: '',
      poster: '',
      imdbRating: 0,
      metascore: 0,
      releaseDate: '',
      quality: '1080p',
    };
  }
}
