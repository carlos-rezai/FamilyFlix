/** The **Genre pool**'s twelve names, as migration 1 seeded them. */
const POOL = new Set([
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Sci-Fi',
  'Thriller',
  'Romance',
  'Documentary',
  'Animation',
  'Family',
  'Adventure',
  'Crime',
]);

/** TMDB's movie genre ids, as a search result's `genre_ids` carries them. */
const TMDB_GENRE_NAMES: Readonly<Record<number, string>> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

/** TMDB's names for a pool genre that the pool spells otherwise. */
const RENAMED: Readonly<Record<string, string>> = {
  'Science Fiction': 'Sci-Fi',
};

/** TMDB's TV compounds, split into the pool names they carry. */
const COMPOUNDS: Readonly<Record<string, readonly string[]>> = {
  'Action & Adventure': ['Action', 'Adventure'],
  'Sci-Fi & Fantasy': ['Sci-Fi'],
};

/**
 * Pure: TMDB's genre names → the **Genre pool**, in TMDB's order. A name the
 * pool holds is kept, _Science Fiction_ is Sci-Fi, a TV compound is split
 * (_Action & Adventure_ → Action + Adventure), and everything else is
 * dropped — a Sync never grows the pool.
 */
export function tmdbGenres(names: readonly string[]): string[] {
  const mapped: string[] = [];
  for (const name of names) {
    for (const genre of COMPOUNDS[name] ?? [RENAMED[name] ?? name]) {
      if (POOL.has(genre) && !mapped.includes(genre)) {
        mapped.push(genre);
      }
    }
  }
  return mapped;
}

/** Pure: a TMDB movie genre id → TMDB's own name for it, `null` for an unknown id. */
export function tmdbGenreName(id: number): string | null {
  return TMDB_GENRE_NAMES[id] ?? null;
}
