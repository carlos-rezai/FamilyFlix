import {
  ENRICH_FIELD_LABELS,
  type ConflictField,
  type EnrichField,
  type EnrichScope,
  type FieldConflict,
} from '@/types';
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
  /** Filled fields that differ from TMDB, outside _Only what's missing_. */
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

/** The five a filled value can disagree on; the diff labels them as the chips do. */
const CONFLICT_FIELDS: ReadonlySet<EnrichField> = new Set<ConflictField>([
  'synopsis',
  'year',
  'genres',
  'director',
  'cast',
]);

const isConflictField = (field: EnrichField): field is ConflictField =>
  CONFLICT_FIELDS.has(field);

const fold = (value: string): string => value.trim().toLowerCase();

/** A field's value as the diff shows it. */
function shown(value: FetchedFields[EnrichField]): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** Equal after trimming and case-folding; lists as sets. */
function same(
  a: FetchedFields[EnrichField],
  b: FetchedFields[EnrichField]
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const left = new Set(a.map(fold));
    const right = new Set(b.map(fold));
    return (
      left.size === right.size && [...left].every((each) => right.has(each))
    );
  }
  return fold(shown(a)) === fold(shown(b));
}

/**
 * Pure: a title's current values × what TMDB answered × the chips on × the
 * scope → what to write and what to ask. Every empty field whose chip is on is
 * filled; a filled one is never quietly overwritten — outside _Only what's
 * missing_, one of the five TMDB answers differently is a **Field conflict**;
 * Original title and TMDB score are always written when their chip is on.
 * Nothing TMDB left blank is written.
 */
export function planFields({
  current,
  fetched,
  fields,
  scope,
}: PlanInput): FieldPlan {
  const fill: Partial<Record<EnrichField, FetchedFields[EnrichField]>> = {};
  const conflicts: FieldConflict[] = [];
  for (const field of fields) {
    const value = fetched[field];
    if (isEmpty(value)) continue;
    const mine = current[field];
    if (ALWAYS.has(field) || isEmpty(mine)) {
      fill[field] = value;
    } else if (
      scope !== 'missing' &&
      isConflictField(field) &&
      !same(mine, value)
    ) {
      conflicts.push({
        field,
        label: ENRICH_FIELD_LABELS[field],
        mine: shown(mine),
        tmdb: shown(value),
      });
    }
  }
  return { fill: fill as Partial<FetchedFields>, conflicts };
}
