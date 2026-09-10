/**
 * The text a single-valued optional field carries, or `undefined` if there is
 * nothing in it.
 *
 * `optionalYear`'s case over a text column: an optional field the maintainer
 * cleared arrives as `''` rather than as an absent field — that is what lets an
 * edit say a director was *removed* — and `''` is not a director. The detail
 * page draws its "—" from `null`, and would draw an empty gap from an empty
 * string.
 */
export function optionalText(value: string | undefined): string | undefined {
  const text = value?.trim() ?? '';
  return text === '' ? undefined : text;
}
