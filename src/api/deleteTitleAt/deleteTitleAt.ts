/**
 * `DELETE` one title's route, no query and no body: `factoryReset`'s shape.
 * Any `2xx` resolves, its body never read, and so does a `404`: **gone is
 * gone**. Anything else rejects. A Delete keeps originals, so no route refuses
 * one. Shared by `deleteMovie` and `deleteSeries`, so it is its own folder,
 * `postValue`'s precedent.
 */
export async function deleteTitleAt(route: string): Promise<void> {
  const response = await fetch(route, { method: 'DELETE' });

  if (response.ok || response.status === 404) {
    return;
  }
  throw new Error(`DELETE ${route} failed: ${response.status}`);
}
