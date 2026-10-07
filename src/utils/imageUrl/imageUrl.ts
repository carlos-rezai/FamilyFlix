const IMAGE_ROUTE = '/api/images/';

/**
 * A **Stored path** → the url the server's image route serves it at, or `null`
 * for a title with no image. The one spelling of the image route in `src/`.
 */
export function imageUrl(storedPath: string | null): string | null {
  return storedPath ? `${IMAGE_ROUTE}${storedPath}` : null;
}
