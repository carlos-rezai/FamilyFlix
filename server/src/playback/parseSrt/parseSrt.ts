import type { Cue } from '@/types';

/**
 * SubRip into a **Cue list**.
 *
 * The parser's whole job is to stop being SubRip: what comes out is timed in
 * **Absolute position** seconds and indistinguishable from what the other three
 * produce, so that nothing downstream of `parseSubtitle` ever asks what the file
 * was.
 *
 * A record is a blank-line-separated block: a sequence number the file keeps for
 * its own bookkeeping, a timing line, and one or more lines of dialogue. The
 * number is found rather than assumed — the timing line is located by shape, so
 * a file that omits the number, or repeats it, parses the same.
 *
 * A block whose timing cannot be read is skipped rather than thrown over: one
 * mangled record is not a film without subtitles, and a file that is not SubRip
 * at all simply yields nothing, which the route answers `200 []` to.
 */
const TIMING =
  /^\s*(\d+):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/;

/**
 * `hh`, `mm`, `ss` and the fraction, as one number of seconds.
 *
 * The arithmetic is done in whole milliseconds and divided once, rather than
 * adding a fraction to a total: `3723 + 0.4` is not the same double as
 * `3723400 / 1000`, and a cue time is compared against by tests and by nothing
 * else that would forgive the difference.
 */
function seconds(
  hours: string,
  minutes: string,
  secs: string,
  fraction: string
): number {
  const millis =
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(secs) * 1000 +
    Number(fraction.padEnd(3, '0'));
  return millis / 1000;
}

export function parseSrt(source: string): Cue[] {
  const cues: Cue[] = [];

  for (const block of source.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = block.split('\n');
    const at = lines.findIndex((line) => TIMING.test(line));
    if (at === -1) {
      continue;
    }

    const timing = TIMING.exec(lines[at]);
    if (timing === null) {
      continue;
    }

    const text = lines
      .slice(at + 1)
      .join('\n')
      .trim();
    if (text === '') {
      continue;
    }

    cues.push({
      start: seconds(timing[1], timing[2], timing[3], timing[4]),
      end: seconds(timing[5], timing[6], timing[7], timing[8]),
      text,
    });
  }

  return cues;
}
