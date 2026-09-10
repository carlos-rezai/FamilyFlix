import type { Playback } from '../../playback/createPlayback/createPlayback';

/** The units the `runtime_minutes` column stores, and the film's own. */
const SECONDS_PER_MINUTE = 60;

/**
 * The **Runtime label**'s minutes for a film that has just been copied, or
 * `null` when this machine cannot say how long it is.
 *
 * The form has no runtime field and the prototype designs none, so an added
 * movie would render a dash where every seeded one shows a duration. Inventing
 * a field would be redesigning; deriving it from the bytes that just landed is
 * reusing what shipped with the player — `duration` asks the **Playback
 * component**'s probe first and the container's own header second, so a family
 * whose installer has not run yet still gets a runtime for the format most of
 * the folder is in.
 *
 * **It never throws.** The movie is already in the library or about to be, and
 * its bytes are already on disk; a runtime is the least of what the save was
 * for, so every way of failing to derive one ends in the same `null` a film
 * nothing could measure gets.
 *
 * Rounded to the nearest minute, which is the half-minute the glossary already
 * says the catalogue and the file are allowed to disagree by. A film that
 * rounds to nought is `null` rather than nought: nought is a number every
 * reader in the app already treats as unknown, and one would be a fifty-second
 * lie.
 */
export function derivedRuntime(
  playback: Playback,
  storedPath: string
): number | null {
  // A row with no film behind it has nothing to derive from, which is not a
  // failure to derive — a runtime is the least of what is missing.
  if (storedPath === '') {
    return null;
  }

  try {
    const file = playback.videoFile(storedPath);
    if (file === null) {
      return null;
    }

    const seconds = playback.duration(file);
    if (seconds === null) {
      return null;
    }

    const minutes = Math.round(seconds / SECONDS_PER_MINUTE);
    return minutes > 0 ? minutes : null;
  } catch {
    return null;
  }
}
