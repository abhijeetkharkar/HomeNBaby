export interface Cinema {
  id: number | string;
  path: string;
  imdbId: string;
  tmdbId: number;
  type: string;
  title: string;
  year: number;
  releaseDate: string; // Stored as TEXT in SQLite
  rated: string;
  runtime: number;
  genre: string; // Stored as TEXT in SQLite (comma-separated or JSON)
  plot: string;
  imdbRating: number;
  imdbVotes: string; // Stored as TEXT in SQLite
  metascore: number;
  awards?: string;
  language: string; // Stored as TEXT in SQLite
  director: string; // Stored as TEXT in SQLite
  actors: string; // Stored as TEXT in SQLite
  revenue: number;
  poster: string;
  quality: string;
  showCinema: number; // SQLite boolean as INTEGER
  lastUpdatedDate: string;
  
  // Helper properties for UI (computed from TEXT fields)
  genres?: string[];
  languages?: string[];
  directors?: string[];
  actorsList?: string[];
  starMeter?: number;
  starMeterDifferential?: number | string;
}
