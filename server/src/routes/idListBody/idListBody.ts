import type { BodyRead } from '../enrichmentBody/enrichmentBody';

/**
 * A bulk press's body → the ids it names: `ids` a non-empty list of strings,
 * refused in the caller's sentence otherwise. The route layer's one reader of
 * an id list — each body module words its own refusal over it. Whether the run
 * holds each id is the domain's to say.
 */
export function idListBody(
  body: unknown,
  sentence: string
): BodyRead<string[]> {
  const { ids } = (typeof body === 'object' && body !== null ? body : {}) as {
    ids?: unknown;
  };
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id): id is string => typeof id === 'string')
  ) {
    return { ok: false, error: sentence };
  }
  return { ok: true, value: ids };
}
