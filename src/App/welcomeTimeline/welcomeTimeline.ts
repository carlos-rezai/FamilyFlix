/**
 * The welcome's timeline, in ms from the splash's start: every number the
 * splash, the provider and the score read, so they never drift apart.
 */

/** An F's drop lasts this long. */
export const DROP_MS = 520;
/** When each F starts to drop: the first, then the accent one. */
export const DROP_DELAYS = [0, 150] as const;
/** The fraction of the drop at which an F lands, before its settle. */
export const DROP_LANDING = 0.55;

/** Letter `i` rises from `LETTER_START + i·LETTER_STEP` for `LETTER_MS`. */
export const LETTER_START = 520;
export const LETTER_STEP = 40;
export const LETTER_MS = 420;

/** The band crosses the mark from `MARK_SWEEP_START` for `MARK_SWEEP_MS`. */
export const MARK_SWEEP_START = 1000;
export const MARK_SWEEP_MS = 700;

/**
 * Letter `i`'s sweep runs from `LETTER_SWEEP_START + i·LETTER_SWEEP_STEP`
 * for `LETTER_SWEEP_MS`.
 */
export const LETTER_SWEEP_START = 1150;
export const LETTER_SWEEP_STEP = 45;
export const LETTER_SWEEP_MS = 380;

/**
 * The **Welcome intro** and the **Wordmark handoff**. The intro outlasts the
 * last letter's sweep (`1150 + 9·45 + 380`, 1935ms), so the glide starts with
 * no light left on _Flix_; the prototype's 1750 cut it short.
 */
export const INTRO_MS = 1950;
export const HANDOFF_MS = 500;
/** The same under reduced motion: fades alone, 1300ms in all (log 55 Q15). */
export const STILL_INTRO_MS = 900;
export const STILL_HANDOFF_MS = 400;
/** The skip's fade of the **Home layer**. */
export const SKIP_MS = 150;
