/** A series' **Year range**: its first year and its last, `null` while it runs. */
export interface YearSpan {
  year: number;
  endYear: number | null;
}

/**
 * The one reading of a Year range: `2022` is a finished run of one year,
 * `2019–2023` (or `2019-2023`) a range, `2021–` a run still going. Anything
 * else is `null`.
 */
export function yearSpan(text: string): YearSpan | null {
  const lone = /^(\d{4})$/.exec(text);
  if (lone) {
    return { year: Number(lone[1]), endYear: Number(lone[1]) };
  }
  const range = /^(\d{4})\s*[–-]\s*(\d{4})?$/.exec(text);
  if (range) {
    return {
      year: Number(range[1]),
      endYear: range[2] === undefined ? null : Number(range[2]),
    };
  }
  return null;
}
