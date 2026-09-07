/**
 * What the **Movie form** holds while it is being filled in — as distinct from
 * the `NewMovie` the repository is handed and the `Movie` a read hands back.
 *
 * A form's values are the strings a maintainer typed, not the record they will
 * become: `year` is text here because a half-typed year is `'19'`, which is not
 * a number and must not be turned into one before the field is finished. The
 * conversion happens once, at the wire.
 */

/**
 * Every field the form collects. Title, Year and the picked genres are all it
 * holds today; the remaining metadata fields, the rating and the three file
 * slots join it as their slices land, and this stays the one shape the form,
 * its hook and its wire call agree on.
 */
export interface MovieFormValues {
  title: string;
  /** Digits only, at most four — the field cannot hold a non-year. */
  year: string;
  /**
   * The genres picked, by name, **in the order they were picked** — not the
   * pool's order. `genres[0]` is the primary tag the repository has preserved
   * since #3, and the chips are the first caller in the app that can decide
   * what it is. Names rather than ids: the pool is one seeded vocabulary, and a
   * name is what both ends of the wire already spell it with.
   */
  genres: string[];
}
