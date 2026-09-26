import type { EnrichField, EnrichScope, FieldConflict } from '@/types';
import type { FetchedFields } from '../fetchedFields/fetchedFields';

export interface PlanInput {
  /** The title's values now, in the fetched shape. */
  current: FetchedFields;
  fetched: FetchedFields;
  /** The chips that are on. */
  fields: readonly EnrichField[];
  scope: EnrichScope;
}

export interface FieldPlan {
  /** What to write, by chip. */
  fill: Partial<FetchedFields>;
  /** Filled fields that differ from TMDB — the conflict phase's; none yet. */
  conflicts: FieldConflict[];
}

/** Written whenever their chip is on, filled or not. */
const ALWAYS: ReadonlySet<EnrichField> = new Set([
  'originalTitle',
  'tmdbScore',
]);

/** Nothing there: `null`, a blank string, or an empty list. */
function isEmpty(value: FetchedFields[EnrichField]): boolean {
  if (value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Pure: a title's current values × what TMDB answered × the chips on → what
 * to write. Every empty field whose chip is on is filled; a filled one is
 * never quietly overwritten; Original title and TMDB score are always written
 * when their chip is on. Nothing TMDB left blank is written.
 */
export function planFields({ current, fetched, fields }: PlanInput): FieldPlan {
  const fill: Partial<Record<EnrichField, FetchedFields[EnrichField]>> = {};
  for (const field of fields) {
    const value = fetched[field];
    if (isEmpty(value)) continue;
    if (ALWAYS.has(field) || isEmpty(current[field])) {
      fill[field] = value;
    }
  }
  return { fill: fill as Partial<FetchedFields>, conflicts: [] };
}
