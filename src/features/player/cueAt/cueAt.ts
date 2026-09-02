import type { Cue } from '@/types';

/**
 * The line on screen right now: the one **Cue** covering an **Absolute
 * position**, or `null` — which is what the **Subtitle overlay** draws as no
 * box at all.
 *
 * It is a pure function of a position, and that is the whole design. Cues are
 * stamped in absolute position and looked up by absolute position, so there is
 * no cursor to advance, nothing to reset, and **a scrub cannot desync them**. A
 * native `<track>` is timed against **Element time**, which on a stream path is
 * short by the **Stream offset**; there is nothing here for that to be short by.
 *
 * The interval is `start <= t < end`. Inclusive at both ends, two adjacent cues
 * would both be true on the instant they meet and the box would flicker between
 * them; exclusive at the start, every line would appear a frame late.
 *
 * Hand-authored files do overlap, and the first covering cue wins: one box
 * draws one line, and taking the earlier one keeps the answer deterministic
 * rather than whichever the scan happened to reach last.
 */
export function cueAt(cues: Cue[], position: number): Cue | null {
  return (
    cues.find((cue) => cue.start <= position && position < cue.end) ?? null
  );
}
