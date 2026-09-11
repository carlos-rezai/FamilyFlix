/** What the caption says the separator is: "Cast — separate with commas". */
const SEPARATOR = ',';

/** What the names are written back out as — the separator, and a space to read by. */
const JOINER = ', ';

/**
 * The names in a typed **Cast** line.
 *
 * The comma is the whole specification, because the field's own caption is:
 * "separate with commas". Everything this does beyond splitting on it is what
 * that sentence has to survive being taken literally by someone typing quickly
 * — a trailing comma is what the field holds the instant before the next name,
 * a doubled comma and a stray space are what a correction leaves behind, and
 * none of the three is a cast member.
 *
 * An untouched field is no cast at all rather than one nameless person: `[]` is
 * what the detail page draws its "—" from, and `['']` would be a credits line
 * with a gap in it.
 *
 * The order is the maintainer's, exactly as `genres[0]` is: billing order is a
 * decision, and nothing here re-sorts it.
 */
export function castNames(typed: string): string[] {
  return typed
    .split(SEPARATOR)
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

/**
 * The line a stored cast was typed as — {@link castNames} read backwards.
 *
 * Both directions live in this one folder because the round trip is the unit:
 * the **Edit context** puts a stored list back into the same box a maintainer
 * typed it into, and two folders could disagree about what a comma means.
 *
 * An empty cast is an empty field, never a stray comma left for the maintainer
 * to delete.
 */
export function castText(names: string[]): string {
  return names.join(JOINER);
}
