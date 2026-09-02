import type { Cue } from '@/types';

/**
 * WebVTT into a **Cue list**.
 *
 * It looks like SubRip until it does not: a `WEBVTT` header, a full stop for the
 * decimal point, a timestamp whose hour field is optional, cue settings
 * trailing the timing line, named cues, `NOTE` and `STYLE` blocks, and inline
 * tags. It gets its own parser for exactly those quirks and answers the same
 * shape the other three do, in **Absolute position** seconds.
 *
 * The header and the metadata blocks need no special case: a block is a cue
 * only if it contains a timing line, and none of them does.
 */
const TIMING =
  /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d{1,3})/;

/** `hh:mm:ss.ttt` or `mm:ss.ttt`, as one number of seconds. See `parseSrt`. */
function seconds(
  hours: string | undefined,
  minutes: string,
  secs: string,
  fraction: string
): number {
  const millis =
    Number(hours ?? 0) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(secs) * 1000 +
    Number(fraction.padEnd(3, '0'));
  return millis / 1000;
}

/**
 * The words, without the markup. `<v Ana>` and `<i>` mean something to a native
 * renderer; ours draws text, and a tag left in would be read out literally over
 * the film.
 */
function spoken(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function parseVtt(source: string): Cue[] {
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

    const text = spoken(lines.slice(at + 1));
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
