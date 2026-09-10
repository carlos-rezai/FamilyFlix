/**
 * The one value a single-valued field carries, or `undefined` if it was not
 * sent at all.
 *
 * The last wins if a client sent several, which is the rule this function
 * replaced an object assignment to keep. Nothing the app sends repeats a
 * single-valued name; a client this route did not write might, and the last
 * part is the one a form's own encoding would have left standing.
 *
 * A multipart body carries every value of a repeated name, which is what makes
 * the genre chips and the cast a list at all — so reading one back as a single
 * value is a decision, taken here, rather than something the parser did on the
 * way in.
 */
export function onlyField(
  fields: Record<string, string[]>,
  name: string
): string | undefined {
  return fields[name]?.at(-1);
}
