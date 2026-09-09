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
    const extracted = this.extractTitleAndYear(searchString, year);
    const cleanedTitle = extracted.title;
    const effectiveYear = extracted.year;

    this.logger.log(`Enriching movie: "${cleanedTitle}" (Year: ${effectiveYear || 'unknown'}) [from: "${searchString}"]`);

    if (!this.tmdbApiKey && !this.omdbApiKey) {
      this.logger.warn('TMDB_API_KEY and OMDB_API_KEY are not configured. Using fallback metadata.');
      return this.createFallbackMetadata(cleanedTitle, effectiveYear);
    }

    try {
      let tmdbMovie: any = null;

      // 1. Search TMDB with year (if available)
      if (this.tmdbApiKey) {
        try {
          const tmdbParams: Record<string, string> = {
            api_key: this.tmdbApiKey,
            page: '1',
            include_adult: 'true',
            query: cleanedTitle,
          };
          if (effectiveYear && !isNaN(effectiveYear)) {
            tmdbParams['year'] = String(effectiveYear);
          }

          const res = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
            params: tmdbParams,
            timeout: 5000,
          });

          if (res.data?.results && res.data.results.length > 0) {
            tmdbMovie = res.data.results[0];
          } else if (effectiveYear) {
            // Retry TMDB search without year filter
            const retryRes = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
              params: {
                api_key: this.tmdbApiKey,
                page: '1',
                include_adult: 'true',
                query: cleanedTitle,
              },
              timeout: 5000,
            });
            if (retryRes.data?.results && retryRes.data.results.length > 0) {
              tmdbMovie = retryRes.data.results[0];
            }
          }
        } catch (tmdbSearchErr) {
          this.logger.warn(`TMDB search error for "${cleanedTitle}":`, tmdbSearchErr);
        }
      }

      // 2. Get TMDB Movie Details if found
      let imdbId = '';
      let spokenLanguages: string[] = [];
      let runtime = 0;
      let revenue = 0;
      let releaseDate = tmdbMovie?.release_date || '';

      if (tmdbMovie && this.tmdbApiKey) {
        try {
          const tmdbDetailRes = await axios.get(
            `${this.tmdbBaseUrl}/movie/${tmdbMovie.id}?api_key=${this.tmdbApiKey}`,
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
          this.logger.warn(`Failed to fetch TMDB details for ID ${tmdbMovie.id}:`, detailError);
        }
      }

      // 3. Query OMDB (using IMDb ID if available, or direct title search)
      let omdbData: any = null;
      if (this.omdbApiKey) {
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
            const omdbParams: Record<string, string> = {
              apikey: this.omdbApiKey,
              t: cleanedTitle,
              type: 'movie',
              plot: 'full',
            };
            if (effectiveYear) {
              omdbParams['y'] = String(effectiveYear);
            }
            const omdbRes = await axios.get(this.omdbBaseUrl, {
              params: omdbParams,
              timeout: 5000,
            });
            if (omdbRes.data?.Response !== 'False') {
              omdbData = omdbRes.data;
            } else if (effectiveYear) {
              // Retry OMDB search without year
              delete omdbParams['y'];
              const omdbRetryRes = await axios.get(this.omdbBaseUrl, {
                params: omdbParams,
                timeout: 5000,
              });
              if (omdbRetryRes.data?.Response !== 'False') {
                omdbData = omdbRetryRes.data;
              }
            }
          } catch (omdbErr) {
            this.logger.warn(`OMDB lookup by title "${cleanedTitle}" failed:`, omdbErr);
          }
        }
      }

      if (!tmdbMovie && !omdbData) {
        this.logger.warn(`No TMDB or OMDB results found for "${cleanedTitle}"`);
        return this.createFallbackMetadata(cleanedTitle, effectiveYear);
      }

      const parseSafeInt = (val: any, fallback = 0): number => {
        if (val === null || val === undefined || val === 'N/A' || val === '') return fallback;
        const parsed = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
        return isNaN(parsed) ? fallback : parsed;
      };

      const parseSafeFloat = (val: any, fallback = 0): number => {
        if (val === null || val === undefined || val === 'N/A' || val === '') return fallback;
        const parsed = parseFloat(String(val));
        return isNaN(parsed) ? fallback : parsed;
      };

      const releaseYear =
        effectiveYear ||
        parseSafeInt(omdbData?.Year, 0) ||
        (releaseDate ? parseSafeInt(releaseDate.substring(0, 4), 0) : 0) ||
        new Date().getFullYear();

      const posterPath = tmdbMovie?.poster_path
        ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
        : omdbData?.Poster && omdbData.Poster !== 'N/A'
        ? omdbData.Poster
        : '';

      const rawGenre = omdbData?.Genre && omdbData?.Genre !== 'N/A' ? omdbData.Genre : '';
      const genre = (rawGenre && rawGenre.trim()) ? rawGenre.trim() : 'Unknown';

      return {
        imdbId: imdbId || omdbData?.imdbID || '',
        tmdbId: parseSafeInt(tmdbMovie?.id, 0),
        type: omdbData?.Type || 'movie',
        title: omdbData?.Title || tmdbMovie?.title || cleanedTitle,
        year: releaseYear,
        releaseDate: releaseDate || omdbData?.Released || '',
        rated: omdbData?.Rated !== 'N/A' ? omdbData?.Rated || '' : '',
        runtime: parseSafeInt(runtime, 0) || parseSafeInt(omdbData?.Runtime, 0),
        genre,
        plot: omdbData?.Plot !== 'N/A' ? omdbData?.Plot || tmdbMovie?.overview || '' : tmdbMovie?.overview || '',
        imdbRating: parseSafeFloat(omdbData?.imdbRating, parseSafeFloat(tmdbMovie?.vote_average, 0)),
        imdbVotes: omdbData?.imdbVotes !== 'N/A' ? omdbData?.imdbVotes || '' : '',
        metascore: parseSafeInt(omdbData?.Metascore, 0),
        awards: omdbData?.Awards !== 'N/A' ? omdbData?.Awards || '' : '',
        language: spokenLanguages.join(', ') || (omdbData?.Language !== 'N/A' ? omdbData?.Language || '' : ''),
        director: omdbData?.Director !== 'N/A' ? omdbData?.Director || '' : '',
        actors: omdbData?.Actors !== 'N/A' ? omdbData?.Actors || '' : '',
        revenue: parseSafeInt(revenue, 0),
        poster: posterPath,
        quality: '1080p',
      };
    } catch (err) {
      this.logger.error(`Error enriching metadata for "${cleanedTitle}":`, err);
      return this.createFallbackMetadata(cleanedTitle, effectiveYear);
    }
  }

  private extractTitleAndYear(
    rawString: string,
    passedYear?: number
  ): { title: string; year?: number } {
    let base = rawString.replace(/\.[a-zA-Z0-9]{2,4}$/, '');

    // Check for 4-digit release year delimiter
    const yearMatch = base.match(/[\s._([{-](19\d\d|20\d\d)[\s._)\]}-]/);
    let year = passedYear;
    let rawTitle = base;

    if (yearMatch && yearMatch.index !== undefined) {
      year = year || parseInt(yearMatch[1], 10);
      rawTitle = base.substring(0, yearMatch.index);
    }

    let clean = rawTitle.replace(/[._]/g, ' ');
    clean = clean.replace(/\b(\d+mb|\d+(\.\d+)?gb|1080p|720p|480p|4k|2160p|bluray|bdrip|brrip|hdrip|web-dl|webrip|dvdrip|x264|x265|hevc|h264|aac\d*|ac3|dd5\.1|yify|yts(\.lt|\.mx)?|rarbg|mkvcage\d*|mkvchge|mkvcge|shaanig|evo|tigole|stylish(salh| release)?|sujaidr|scorp|kickass|exd|ipt|axxo|extended|remastered)\b/gi, '');
    clean = clean.replace(/\[[^\]]*\]/g, '');
    clean = clean.replace(/\([^)]*\)/g, '');
    clean = clean.replace(/\{[^}]*\}/g, '');
    clean = clean.replace(/[-_=+()]+/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();

    if (!clean) {
      clean = base;
    }

    const title = clean.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    return { title, year };
  }

  private createFallbackMetadata(title: string, year?: number): EnrichedMetadata {
    return {
      type: 'movie',
      title: title,
      year: year || new Date().getFullYear(),
      plot: '',
      genre: 'Unknown',
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
