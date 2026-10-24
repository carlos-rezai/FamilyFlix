import { refusalSentence } from '@/api/refusalSentence/refusalSentence';
import type { DeleteFiles } from '@/types';

/** What a title's delete came to: gone, or refused in the route's sentence. */
export type DeleteOutcome =
  | { kind: 'deleted' }
  | { kind: 'refused'; sentence: string };

/**
 * `DELETE` one title's route, no body — `factoryReset`'s shape. A `204` — any
 * `2xx` — is `deleted`, its body never read, and so is a `404`: **gone is gone**.
 * A `409` naming its reason is `refused` with the route's own sentence.
 * Anything else rejects. Shared by `deleteMovie` and `deleteSeries`, so it is
 * its own folder, `postValue`'s precedent. The **Recycle choice**'s `trash`
 * appends `?files=trash`; `keep` sends the plain `DELETE`, which keeps them.
 */
export async function deleteTitleAt(
  route: string,
  files: DeleteFiles = 'keep'
): Promise<DeleteOutcome> {
  const endpoint = files === 'trash' ? `${route}?files=trash` : route;
  const response = await fetch(endpoint, { method: 'DELETE' });

  if (response.ok || response.status === 404) {
    return { kind: 'deleted' };
  }
  if (response.status === 409) {
    const sentence = await refusalSentence(response);
    if (sentence !== null) {
      return { kind: 'refused', sentence };
    }
  }
  throw new Error(`DELETE ${endpoint} failed: ${response.status}`);
}
