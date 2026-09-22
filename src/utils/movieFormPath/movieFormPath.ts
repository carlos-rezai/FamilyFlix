/** The **Movie form**'s jobs, as the query that names them. */
export interface MovieFormQuery {
  /** The Edit job: the movie being amended. */
  movie?: string;
  /** Import context: the **Problem** being resolved. */
  problem?: string;
}

/**
 * The **Movie form**, as a route — `/add`, `/add?movie=<id>`,
 * `/add?problem=<id>`, or both, the movie first. Two features name it: the
 * ⋯ menu's _Edit details_ and the **Review step**'s _Resolve_.
 *
 * The ids travel through `URLSearchParams`, as the library and genre queries
 * already do, so an id reads back whole whatever it holds — a raw `&` would
 * start a parameter of its own, a raw `#` a fragment.
 *
 * Pure, so the same ids always yield the same route.
 */
export function movieFormPath({ movie, problem }: MovieFormQuery): string {
  const params = new URLSearchParams();
  if (movie !== undefined) params.set('movie', movie);
  if (problem !== undefined) params.set('problem', problem);
  const query = params.toString();
  return query === '' ? '/add' : `/add?${query}`;
}
