import {
  ENRICH_FIELDS,
  ENRICH_SCOPES,
  type ConflictChoices,
  type EnrichField,
  type EnrichScope,
  type StartEnrichment,
} from '@/types';

/** A body read into what the domain is handed, or the sentence a `400` says. */
export type BodyRead<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * `POST /api/enrichment`'s body → the **Sync**'s options: a known scope, a
 * movie id for `single` and only for `single`, known fields, and the two
 * **Write target** booleans. The refusals are checked in that order, so a body
 * wrong in two ways earns the first sentence. Whether the library holds the
 * movie is the domain's to say.
 */
export function startEnrichmentBody(body: unknown): BodyRead<StartEnrichment> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object' };
  }
  const { scope, movieId, fields, writeSheet, writePosters } = body as Record<
    string,
    unknown
  >;
  if (!ENRICH_SCOPES.includes(scope as EnrichScope)) {
    return { ok: false, error: 'Unknown scope' };
  }
  if (
    scope === 'single' &&
    (typeof movieId !== 'string' || movieId.length === 0)
  ) {
    return { ok: false, error: 'A single-title Sync names its movie' };
  }
  if (scope !== 'single' && movieId !== undefined) {
    return { ok: false, error: 'Only a single-title Sync names a movie' };
  }
  if (
    !Array.isArray(fields) ||
    !fields.every((field) => ENRICH_FIELDS.includes(field as EnrichField))
  ) {
    return { ok: false, error: 'Unknown field' };
  }
  if (typeof writeSheet !== 'boolean' || typeof writePosters !== 'boolean') {
    return { ok: false, error: 'writeSheet and writePosters are booleans' };
  }
  return {
    ok: true,
    value: {
      scope: scope as EnrichScope,
      ...(typeof movieId === 'string' ? { movieId } : {}),
      fields: fields as EnrichField[],
      writeSheet,
      writePosters,
    },
  };
}

/**
 * _Apply choices_' body → its **Field conflict** choices: `choices` a map of
 * each field to `mine` or `tmdb`. Which fields the Decision holds is the
 * domain's to say.
 */
export function conflictChoicesBody(body: unknown): BodyRead<ConflictChoices> {
  const { choices } = (body ?? {}) as { choices?: unknown };
  if (
    typeof choices !== 'object' ||
    choices === null ||
    Array.isArray(choices) ||
    !Object.values(choices).every((side) => side === 'mine' || side === 'tmdb')
  ) {
    return { ok: false, error: 'Choices map each field to a side' };
  }
  return { ok: true, value: choices as ConflictChoices };
}
