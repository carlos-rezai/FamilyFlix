/**
 * Turns a 0–1 scalar into the percent string a styled component sets a width
 * from — the **Scrubber**'s fill and knob, and the volume bar's fill.
 *
 * **Rounded to one decimal place**, which is the whole reason it exists.
 * `position / duration` on a two-hour film is a float with seventeen digits
 * behind it, and handing that straight to CSS writes
 * `width: 33.33333333333333%` into the style attribute ten times a second.
 * One decimal is finer than a pixel on any bar the player draws and reads as a
 * number in the inspector.
 *
 * The caller is trusted for the range: both sliders take their scalar from
 * `useDragScalar`, which clamps, so a second clamp here would be a rule stated
 * twice and enforced in the wrong place.
 */
export function toScalarPercent(scalar: number): string {
  return `${Math.round(scalar * 1000) / 10}%`;
}
