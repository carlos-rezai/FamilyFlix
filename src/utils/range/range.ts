/**
 * The indices `0` to `length - 1`.
 *
 * For rendering a fixed number of somethings — skeleton placeholders above all,
 * where each one needs nothing but a key its siblings do not share. A length of
 * zero, or below it, is an empty list rather than an error: "no placeholders" is
 * a thing a screen can legitimately want.
 *
 * Pure: the same length always yields the same list, and nothing outside it is
 * read or written.
 */
export function range(length: number): number[] {
  return Array.from({ length: Math.max(0, length) }, (_, index) => index);
}
