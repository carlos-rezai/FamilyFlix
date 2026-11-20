import { postValue } from '@/api/postValue/postValue';

/** Where _Show video quality_ is written. */
const QUALITY_TAGS_ENDPOINT = '/api/settings/quality-tags';

/** What the quality-tags route accepts as an echo of what it stored. */
function isQualityTagsEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves the household's _Show video quality_ and answers with the value that
 * was stored: `saveTmdbRatings`' twin, the wire contract in `postValue` with
 * a flag as its echo. Rejects if the save did not succeed, which is the
 * provider's cue to put the previous value back.
 */
export function saveQualityTags(on: boolean): Promise<boolean> {
  return postValue(QUALITY_TAGS_ENDPOINT, on, isQualityTagsEcho);
}
