/** What a title's delete came to: gone, or refused in the route's sentence. */
export type DeleteOutcome =
  | { kind: 'deleted' }
  | { kind: 'refused'; sentence: string };

/** Whether a refusal's body names its reason. */
function namesAReason(body: unknown): body is { error: string } {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  return typeof (body as { error?: unknown }).error === 'string';
}

/**
 * `DELETE` one title's route, no body — `factoryReset`'s shape. A `204` — any
 * `2xx` — is `deleted`, its body never read, and so is a `404`: **gone is gone**.
 * A `409` naming its reason is `refused` with the route's own sentence.
 * Anything else rejects. Shared by `deleteMovie` and `deleteSeries`, so it is
 * its own folder, `postValue`'s precedent.
 */
export async function deleteTitleAt(endpoint: string): Promise<DeleteOutcome> {
  const response = await fetch(endpoint, { method: 'DELETE' });

  if (response.ok || response.status === 404) {
    return { kind: 'deleted' };
  }
  if (response.status === 409) {
    const body: unknown = await response.json().catch(() => null);
    if (namesAReason(body)) {
      return { kind: 'refused', sentence: body.error };
    }
  }
  throw new Error(`DELETE ${endpoint} failed: ${response.status}`);
}
