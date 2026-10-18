const IMAGE_ROUTE = '/api/images/';

/**
 * A **Stored path** → the url the server's image route serves it at, or `null`
 * for a title with no image. The one spelling of the image route in `src/`.
 *
 * Each segment is encoded: a Still is named after its video, spaces, `#` and
 * all, and none of those survives a url as it is.
 */
export function imageUrl(storedPath: string | null): string | null {
  return storedPath
    ? `${IMAGE_ROUTE}${storedPath.split('/').map(encodeURIComponent).join('/')}`
    : null;
}
