import type { Candidate } from '@/types';
import { releaseYear } from '../fetchedFields/fetchedFields';
import { matchScore, type TitledYear } from '../matchScore/matchScore';
import type { TmdbMovieResult } from '../tmdbClient/tmdbClient';
import { tmdbGenreName, tmdbGenres } from '../tmdbGenres/tmdbGenres';

/** How many candidates an `ambiguous` **Decision** carries. */
export const CANDIDATE_CAP = 3;

/** Where the review's candidate posters load from, straight off TMDB. */
export const CANDIDATE_POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

/** A `missing` Decision's reason when the title itself matched nothing. */
export const NO_MATCH_REASON = 'Nothing on TMDB matched this title.';

/** A `missing` Decision's reason when a search typed in the review did. */
export const noMatchFor = (query: string): string =>
  `Nothing on TMDB matched “${query}”.`;

/** A `conflict` Decision's reason. */
export const CONFLICT_REASON =
  'TMDB has different values for fields you already filled in.';

/** A search result as `matchScore` reads it. */
export function titledYear(result: TmdbMovieResult): TitledYear {
  return { title: result.title, year: releaseYear(result.release_date) };
}

/** The first of a result's genres the **Genre pool** holds, or `null`. */
function poolGenre(ids: readonly number[]): string | null {
  for (const id of ids) {
    const name = tmdbGenreName(id);
    const [genre] = name === null ? [] : tmdbGenres([name]);
    if (genre !== undefined) return genre;
  }
  return null;
}

/**
 * Pure: the best three results by **Match score** against `ours`, as the
 * picker's **Candidates** — the genre off the pool, the language upper-cased,
 * the poster on TMDB's image host.
 */
export function candidatesFor(
  ours: TitledYear,
  results: readonly TmdbMovieResult[]
): Candidate[] {
  return results
    .map(
      (result): Candidate => ({
        tmdbId: result.id,
        title: result.title,
        year: releaseYear(result.release_date),
        genre: poolGenre(result.genre_ids),
        language: result.original_language
          ? result.original_language.toUpperCase()
          : null,
        posterUrl:
          result.poster_path === null
            ? null
            : `${CANDIDATE_POSTER_BASE}${result.poster_path}`,
        score: matchScore(ours, titledYear(result)),
      })
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_CAP);
}

const COUNT_WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
];

/** Pure: an `ambiguous` reason, the count of releases spelled out to twenty. */
export function ambiguousReason(count: number): string {
  const spelled = COUNT_WORDS[count] ?? String(count);
  return count === 1
    ? `${spelled} release shares this title — pick the right one.`
    : `${spelled} releases share this title — pick the right one.`;
}

/** What a Decision shows for a search: its kind, reason, query and picker. */
export type DecisionFace =
  | {
      kind: 'ambiguous';
      reason: string;
      query: string;
      candidates: Candidate[];
    }
  | { kind: 'missing'; reason: string; query: string };

/**
 * Pure: what a search came to, as the Decision's face — candidates in the
 * picker, or the box kept with `missingReason`.
 */
export function decisionFace(
  ours: TitledYear,
  query: string,
  results: readonly TmdbMovieResult[],
  missingReason: string
): DecisionFace {
  if (results.length === 0) {
    return { kind: 'missing', reason: missingReason, query };
  }
  return {
    kind: 'ambiguous',
    reason: ambiguousReason(results.length),
    query,
    candidates: candidatesFor(ours, results),
  };
}
