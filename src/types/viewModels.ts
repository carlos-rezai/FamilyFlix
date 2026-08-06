/**
 * The frontend's view models — a `Movie` narrowed to exactly what a screen
 * renders, with the units already converted. They live here rather than
 * beside the components that render them because more than one feature reads
 * them (see `docs/handoff/COMPONENT-SPEC.md` §5).
 */

/**
 * The view model a `PosterCard` renders from — a `Movie` flattened to exactly
 * what the tile shows, built by the `view()` mapper (`features/library/view.ts`).
 * `rating` and `progress` are 0–100 percents (not stored units), `posterUrl` is
 * a ready image-route URL or `null`, and `g1`/`g2` are the placeholder gradient
 * stops used when there is no poster.
 */
export interface PosterCardMovie {
  id: string;
  title: string;
  posterUrl: string | null;
  g1: string;
  g2: string;
  rating: number;
  watched: boolean;
  progress: number;
  favorite: boolean;
}

/**
 * A {@link HomeRow} after the frontend has mapped every `Movie` through
 * `view()` — what a `GenreRow` actually renders. Same genre and same **true
 * total** `count`; only the movies are narrowed to their card view models.
 */
export interface GenreRowModel {
  genre: string;
  count: number;
  movies: PosterCardMovie[];
}
