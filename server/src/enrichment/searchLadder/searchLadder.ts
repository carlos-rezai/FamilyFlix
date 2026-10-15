/** One rung of the **Search ladder**: what a TMDB search is sent. */
export interface SearchRung {
  query: string;
  year: number | null;
}

/**
 * The **Search ladder**: a title and its year → the rungs a look-up climbs,
 * in order — the title with its year, then without it. A rung equal to one
 * already listed is dropped, so a title with no year is one rung.
 */
export function searchLadder(title: string, year: number | null): SearchRung[] {
  const rungs: SearchRung[] = [
    { query: title, year },
    { query: title, year: null },
  ];
  return rungs.filter(
    (rung, index) =>
      rungs.findIndex(
        (each) => each.query === rung.query && each.year === rung.year
      ) === index
  );
}
