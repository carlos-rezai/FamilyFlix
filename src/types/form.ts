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
 * What is in one of the form's **File slots**: nothing, a **Stored file** the
 * library already holds, or a **Picked file** the maintainer has just chosen off
 * their own disk.
 *
 * A discriminated union rather than one shape with optional halves, because the
 * two are genuinely different things on the way out: a stored file travels as
 * the relative path it already has, and a picked one travels as bytes in a part.
 * `filename` is what both of them show in the slot, and it is the only thing a
 * browser will say about a `File` — there is no path, ever.
 *
 * The `stored` arm is unreachable from the **Add context** and arrives with the
 * edit slice; it is here now because the slot's own type is what the two
 * contexts share.
 */
export type MovieFormFile =
  | { kind: 'stored'; path: string; filename: string }
  | { kind: 'picked'; file: File; filename: string };

/**
 * Every field the form collects. The whole of the form's own surface is here
 * now; the three file slots join it as their slices land, and this stays the
 * one shape the form, its hook and its wire call agree on.
 */
export interface MovieFormValues {
  title: string;
  /** Digits only, at most four — the field cannot hold a non-year. */
  year: string;
  director: string;
  /**
   * The cast **as it is being typed** — one line, names separated by commas,
   * exactly as the field's own caption says. It is the one value here whose
   * typed shape and stored shape differ, and it is deliberately held as the
   * typing rather than as the names: a field that tidied itself mid-typing
   * would delete the comma just pressed. `castNames` resolves it once, at the
   * wire.
   */
  cast: string;
  /** The synopsis. `description` is the form's word for it; the column's is
   *  `synopsis`, and the rename happens once, at the route. */
  description: string;
  /**
   * The score, as the 0–100 percent `RatingPicker` speaks and every star strip
   * in the app fills against — never the 0–10 units the column stores, which
   * `toRatingUnits` converts to once, at the wire.
   *
   * `null` is **Unrated**, and it is emphatically not `0`: "I have not decided"
   * and "nought out of five" are two different claims, and the distinction has
   * to survive from the picker to the row.
   */
  rating: number | null;
  /**
   * The film itself, or `null` for an empty **File slot** — which is what the
   * **Add context** opens on, and the half of the **Save gate** a title cannot
   * satisfy on its own.
   *
   * `video_path` is `NOT NULL`, and now that the form can offer a film, a row
   * with nothing behind it is no longer one this screen writes.
   */
  video: MovieFormFile | null;
  /**
   * The genres picked, by name, **in the order they were picked** — not the
   * pool's order. `genres[0]` is the primary tag the repository has preserved
   * since #3, and the chips are the first caller in the app that can decide
   * what it is. Names rather than ids: the pool is one seeded vocabulary, and a
   * name is what both ends of the wire already spell it with.
   */
  genres: string[];
}
