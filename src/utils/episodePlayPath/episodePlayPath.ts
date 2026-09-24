/**
 * The player on one **Episode**, as a route — `/episode/<id>/play`. What the
 * series page's and the season page's Resume / Play buttons and an **Episode
 * row** open. `moviePath`'s precedent: the id is encoded, so it travels as one
 * path segment however it is spelled.
 */
export function episodePlayPath(id: string): string {
  return `/episode/${encodeURIComponent(id)}/play`;
}
