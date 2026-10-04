import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import axios from 'axios';
import { DynamoDbService } from '../dynamodb/dynamodb.service';
import { TelemetryService } from '../telemetry/telemetry.service';

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

  constructor(
    @Optional() @Inject(DynamoDbService) private readonly dynamoDb?: DynamoDbService,
    @Optional() @Inject(TelemetryService) private readonly telemetry?: TelemetryService
  ) {}

  /**
   * Enrich movie with metadata from TMDB and OMDB APIs (with DynamoDB master cache)
   * @param searchString - Movie title
   * @param year - Optional release year
   * @param languageHint - Optional ISO 639-1 language hint (e.g. 'hi', 'en', 'es')
   * @returns Enriched metadata or fallback object
   */
  async enrichMovie(
    searchString: string,
    year?: number,
    languageHint?: string
  ): Promise<EnrichedMetadata> {
    const extracted = this.extractTitleAndYear(searchString, year);
    const cleanedTitle = extracted.title;
    const effectiveYear = extracted.year;
    const baseKey = `${cleanedTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}_${effectiveYear || 0}`;
    const canonicalKey = languageHint ? `${baseKey}_${languageHint}` : baseKey;

    // 1. Check Master Cache
    if (this.dynamoDb) {
      try {
        let cached = await this.dynamoDb.getItem<any>(
          this.dynamoDb.masterMoviesTable,
          { canonicalKey }
        );
        if (!cached && languageHint) {
          cached = await this.dynamoDb.getItem<any>(
            this.dynamoDb.masterMoviesTable,
            { canonicalKey: baseKey }
          );
        }
        if (cached && cached.metadata) {
          this.logger.log(`[Cache Hit] Master cache resolved "${canonicalKey}" (${cleanedTitle})`);
          if (this.telemetry) {
            this.telemetry.recordCacheHit(canonicalKey, {
              title: cleanedTitle,
              year: effectiveYear,
              poster: cached.metadata.poster,
            }).catch(() => {});
          }
          return cached.metadata as EnrichedMetadata;
        }
      } catch (cacheErr) {
        this.logger.warn(`Master cache lookup failed for "${canonicalKey}":`, cacheErr);
      }
    }

    this.logger.log(`Enriching movie: "${cleanedTitle}" (Year: ${effectiveYear || 'unknown'}, Lang: ${languageHint || 'none'}) [from: "${searchString}"]`);

    if (!this.tmdbApiKey && !this.omdbApiKey) {
      this.logger.warn('TMDB_API_KEY and OMDB_API_KEY are not configured. Using fallback metadata.');
      return this.createFallbackMetadata(cleanedTitle, effectiveYear);
    }

    try {
      let tmdbMovie: any = null;

      // 1. Search TMDB with scoring and year fallback
      if (this.tmdbApiKey) {
        try {
          const candidates: any[] = [];

          // 1a. Search TMDB with year (if available)
          if (effectiveYear && !isNaN(effectiveYear)) {
            try {
              const resWithYear = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
                params: {
                  api_key: this.tmdbApiKey,
                  page: '1',
                  include_adult: 'true',
                  query: cleanedTitle,
                  year: String(effectiveYear),
                },
                timeout: 5000,
              });
              if (resWithYear.data?.results) {
                candidates.push(...resWithYear.data.results);
              }
            } catch (yearErr) {
              this.logger.warn(`TMDB year-specific search failed for "${cleanedTitle}":`, yearErr);
            }
          }

          // 1b. Search TMDB without year constraint if no candidates or if year candidates lack an exact match
          const hasExactMatch = candidates.some((c) => {
            const t = (c.title || '').trim().toLowerCase();
            const ot = (c.original_title || '').trim().toLowerCase();
            const q = cleanedTitle.trim().toLowerCase();
            return t === q || ot === q;
          });

          if (!hasExactMatch) {
            try {
              const resNoYear = await axios.get(`${this.tmdbBaseUrl}/search/movie`, {
                params: {
                  api_key: this.tmdbApiKey,
                  page: '1',
                  include_adult: 'true',
                  query: cleanedTitle,
                },
                timeout: 5000,
              });
              if (resNoYear.data?.results) {
                candidates.push(...resNoYear.data.results);
              }
            } catch (noYearErr) {
              this.logger.warn(`TMDB broad search failed for "${cleanedTitle}":`, noYearErr);
            }
          }

          // Deduplicate candidates by TMDB ID
          const uniqueCandidates = new Map<number, any>();
          for (const cand of candidates) {
            if (cand && cand.id && !uniqueCandidates.has(cand.id)) {
              uniqueCandidates.set(cand.id, cand);
            }
          }

          // Score and rank candidates
          if (uniqueCandidates.size > 0) {
            const ranked = Array.from(uniqueCandidates.values())
              .map((cand) => ({
                cand,
                score: this.scoreTmdbCandidate(cand, cleanedTitle, effectiveYear, languageHint),
              }))
              .sort((a, b) => b.score - a.score);

            if (ranked.length > 0 && ranked[0].score > 0) {
              tmdbMovie = ranked[0].cand;
              this.logger.log(
                `[TMDB Selected] "${tmdbMovie.title}" (${tmdbMovie.release_date || 'N/A'}) ID: ${tmdbMovie.id} [Score: ${ranked[0].score.toFixed(1)}]`
              );
            }
          }

          if (this.telemetry) {
            this.telemetry.recordExternalCall('tmdb', true, canonicalKey, {
              title: cleanedTitle,
              year: effectiveYear,
            }).catch(() => {});
          }
        } catch (tmdbSearchErr) {
          this.logger.warn(`TMDB search error for "${cleanedTitle}":`, tmdbSearchErr);
          if (this.telemetry) {
            this.telemetry.recordExternalCall(
              'tmdb',
              false,
              canonicalKey,
              { title: cleanedTitle, year: effectiveYear },
              String((tmdbSearchErr as any)?.message || tmdbSearchErr)
            ).catch(() => {});
          }
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
            if (
              omdbRes.data?.Response !== 'False' &&
              this.isCloseTitleMatch(omdbRes.data?.Title, cleanedTitle)
            ) {
              omdbData = omdbRes.data;
            } else if (effectiveYear) {
              // Retry OMDB search without year if year resulted in mismatch or False
              delete omdbParams['y'];
              const omdbRetryRes = await axios.get(this.omdbBaseUrl, {
                params: omdbParams,
                timeout: 5000,
              });
              if (
                omdbRetryRes.data?.Response !== 'False' &&
                (this.isCloseTitleMatch(omdbRetryRes.data?.Title, cleanedTitle) || !omdbData)
              ) {
                omdbData = omdbRetryRes.data;
              }
            }

            if (this.telemetry) {
              this.telemetry.recordExternalCall('omdb', true, canonicalKey, {
                title: cleanedTitle,
                year: effectiveYear,
                poster: omdbData?.Poster,
              }).catch(() => {});
            }
          } catch (omdbErr) {
            this.logger.warn(`OMDB lookup by title "${cleanedTitle}" failed:`, omdbErr);
            if (this.telemetry) {
              this.telemetry.recordExternalCall(
                'omdb',
                false,
                canonicalKey,
                { title: cleanedTitle, year: effectiveYear },
                String((omdbErr as any)?.message || omdbErr)
              ).catch(() => {});
            }
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
        parseSafeInt(omdbData?.Year, 0) ||
        (releaseDate ? parseSafeInt(releaseDate.substring(0, 4), 0) : 0) ||
        effectiveYear ||
        new Date().getFullYear();

      const posterPath = tmdbMovie?.poster_path
        ? `https://image.tmdb.org/t/p/w500${tmdbMovie.poster_path}`
        : omdbData?.Poster && omdbData.Poster !== 'N/A'
        ? omdbData.Poster
        : '';

      const rawGenre = omdbData?.Genre && omdbData?.Genre !== 'N/A' ? omdbData.Genre : '';
      const genre = (rawGenre && rawGenre.trim()) ? rawGenre.trim() : 'Unknown';

      const enriched: EnrichedMetadata = {
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

      if (this.dynamoDb && enriched.title) {
        try {
          await this.dynamoDb.putItem(this.dynamoDb.masterMoviesTable, {
            canonicalKey,
            title: enriched.title,
            year: enriched.year || effectiveYear || 0,
            metadata: enriched,
            updatedAt: new Date().toISOString(),
          });
          this.logger.log(`[Cache Write] Stored "${canonicalKey}" in master movies cache.`);
        } catch (writeErr) {
          this.logger.warn(`Failed to write "${canonicalKey}" to master cache:`, writeErr);
        }
      }

      return enriched;
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
    const yearMatch = base.match(/[\s._([{-](19\d\d|20\d\d)([\s._)\]}-]|$)/);
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

  private isCloseTitleMatch(candidateTitle?: string, queryTitle?: string): boolean {
    if (!candidateTitle || !queryTitle) return false;
    const stripArticles = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/[^a-z0-9]/g, '');
    const c = stripArticles(candidateTitle);
    const q = stripArticles(queryTitle);
    return c === q;
  }

  private scoreTmdbCandidate(
    cand: any,
    cleanTitle: string,
    targetYear?: number,
    languageHint?: string
  ): number {
    if (!cand || !cand.title) return -999;

    let score = 0;
    const candTitle = cand.title.trim().toLowerCase();
    const candOrigTitle = (cand.original_title || '').trim().toLowerCase();
    const target = cleanTitle.trim().toLowerCase();

    const stripArticles = (s: string) => s.replace(/^(the|a|an)\s+/i, '').trim();
    const targetNoArticles = stripArticles(target);
    const candNoArticles = stripArticles(candTitle);

    // 1. Title Matching
    if (candTitle === target || candOrigTitle === target) {
      score += 120; // Exact title match
    } else if (candNoArticles === targetNoArticles) {
      score += 100; // Exact match ignoring leading articles
    } else if (candTitle.startsWith(target + ' ') || candTitle.endsWith(' ' + target)) {
      score += 20; // Word prefix/suffix
    } else if (candTitle.includes(target)) {
      score += 10; // Substring
    } else {
      score -= 30; // Neither exact nor substring
    }

    // 2. Release Year Matching
    const candYear = cand.release_date ? parseInt(cand.release_date.substring(0, 4), 10) : 0;
    if (targetYear && candYear) {
      const diff = Math.abs(candYear - targetYear);
      if (diff === 0) {
        score += 50; // Exact year
      } else if (diff === 1) {
        score += 40; // 1 year diff (late release or festival/theatrical lag)
      } else if (diff === 2) {
        score += 30; // 2 years diff (festival premiere vs general/home release)
      } else if (diff <= 4) {
        score += 10;
      } else if (diff > 15) {
        score -= 50; // Vastly different era
      }
    }

    // 3. Language Matching
    if (languageHint && cand.original_language) {
      if (cand.original_language.toLowerCase() === languageHint.toLowerCase()) {
        score += 50; // Boost matching language
      } else {
        score -= 10;
      }
    }

    // 4. Popularity Tie-breaker
    const popularity = typeof cand.popularity === 'number' ? cand.popularity : 0;
    score += Math.min(popularity, 15);

    return score;
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
