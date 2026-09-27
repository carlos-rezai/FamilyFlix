import { titleKey } from '../../import-export/titleKey/titleKey';

/** A title and its year, ours or TMDB's — `null` for a year nobody knows. */
export interface TitledYear {
  title: string;
  year: number | null;
}

const TITLE_POINTS = 70;
const YEAR_POINTS = 30;
const YEAR_ONE_OFF_POINTS = 15;

/** The distinct words of a Title key. */
function words(key: string): Set<string> {
  return new Set(key.split(' ').filter((word) => word.length > 0));
}

/**
 * The title's share: 1 for an equal **Title key**, else the distinct words
 * the two keys share over the larger of the two word counts.
 */
function titleOverlap(ours: string, theirs: string): number {
  const a = titleKey(ours);
  const b = titleKey(theirs);
  if (a === b) return 1;
  const mine = words(a);
  const their = words(b);
  const larger = Math.max(mine.size, their.size);
  if (larger === 0) return 0;
  let shared = 0;
  for (const word of mine) {
    if (their.has(word)) shared += 1;
  }
  return shared / larger;
}

/** The year's points: equal 30, one off 15, unknown or further 0. */
function yearPoints(ours: number | null, theirs: number | null): number {
  if (ours === null || theirs === null) return 0;
  const apart = Math.abs(ours - theirs);
  if (apart === 0) return YEAR_POINTS;
  return apart === 1 ? YEAR_ONE_OFF_POINTS : 0;
}

/**
 * Pure: our title and year × a TMDB result → the **Match score**, 0–100, the
 * _% match_ the candidate picker draws. 70 for the title and 30 for the year,
 * rounded to a whole percent.
 */
export function matchScore(ours: TitledYear, theirs: TitledYear): number {
  return Math.round(
    titleOverlap(ours.title, theirs.title) * TITLE_POINTS +
      yearPoints(ours.year, theirs.year)
  );
}

/**
 * **Confident**: the search answered exactly one candidate, its Title key
 * equal to ours and, when our title has a year, its year equal too.
 */
export function confident(
  ours: TitledYear,
  candidates: readonly TitledYear[]
): boolean {
  if (candidates.length !== 1) return false;
  const [only] = candidates;
  return (
    titleKey(only.title) === titleKey(ours.title) &&
    (ours.year === null || only.year === ours.year)
  );
}
