/**
 * The **Year range** as it is written: `2022` for a run inside one year,
 * `2019–2023` for a finished one, `2021–` for one still open, and `null`
 * without a year. The client's mirror of the server's `spellYearSpan`, held to
 * the server's `yearSpan` by a round-trip guard: what this writes, that reads
 * back as the same span.
 *
 * Pure, so the same span always yields the same text.
 */
export function spellYearSpan(
  year: number | null,
  endYear: number | null
): string | null {
  if (year === null) {
    return null;
  }
  if (endYear === year) {
    return String(year);
  }
  return `${year}–${endYear ?? ''}`;
}
