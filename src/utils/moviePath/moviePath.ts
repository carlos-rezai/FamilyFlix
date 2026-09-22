/**
 * The film's page, as a route — `/movie/<id>`. Four features name it: the
 * browse home and the genre grid open a card onto it, and it is the player's
 * **Landing** and the edit job's. A route two screens name is written once, on
 * the same rule that moves a wire call into `api/` when a second feature asks
 * for it.
 *
 * The id is encoded on its way into the path, as an id is wherever the app
 * puts one in a URL. That is consistency rather than a live need — a movie id
 * is an RFC-4122 UUID, every character of it already URL-safe — but the next
 * id-shaped thing in a route may not be one.
 *
 * Pure, so the same id always yields the same route.
 */
export function moviePath(id: string): string {
  return `/movie/${encodeURIComponent(id)}`;
}
