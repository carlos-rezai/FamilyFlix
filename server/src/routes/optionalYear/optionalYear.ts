/**
 * The **year** a form field carries, or `undefined` for a film whose year the
 * maintainer does not know.
 *
 * An empty string is the case worth naming: the Year field is optional, a
 * cleared one arrives as `''` rather than as an absent field — that is what lets
 * an edit say the year was *removed* — and `Number('')` is `0`, a value that
 * would sort and display as a real year. Anything else that is not a whole
 * number is no year either; the field itself accepts digits only, so this arm
 * exists for a caller that is not the form.
 */
export function optionalYear(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const year = Number(value);
  return Number.isInteger(year) ? year : undefined;
}
