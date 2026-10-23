import type { Subtitle } from '@/types';
import { inTrackOrder } from '@/utils';

/**
 * The first row in track order spoken in `language`, compared without case:
 * the rows are whatever the importer wrote and a language is whatever the
 * Settings dropdown or the sitting handed over, so `EN` and `en` are one
 * language. No language matches nothing.
 */
function spokenIn(
  byPosition: Subtitle[],
  language: string | null | undefined
): Subtitle | undefined {
  const spoken = language?.toLowerCase();
  return spoken
    ? byPosition.find((track) => track.language.toLowerCase() === spoken)
    : undefined;
}

/**
 * Which of a film's **Subtitles** becomes the **Subtitle track**: the
 * **Subtitle choice** carried from an earlier player in the sitting where a
 * row speaks it; else the **Preferred subtitle language**; else track order.
 * `preferredAudio` is its twin.
 *
 * **The answer is deterministic.** A film that opened in Portuguese yesterday
 * and English today would be something the family had no way to correct, so
 * the answer is a pure function of the rows, the choice and the preference,
 * and never of the order the rows happened to arrive in. A choice no row
 * speaks falls to the preference, not to the first row.
 *
 * The preference arrives from the opening settings read and is optional
 * because a refused read is no preference, not English; `null` and absent are
 * no choice.
 *
 * `null` for a film with no subtitle files, which is what the CC button not
 * being drawn at all is decided from.
 */
export function preferredSubtitle(
  subtitles: Subtitle[],
  language?: string,
  choice?: string | null
): Subtitle | null {
  const byPosition = inTrackOrder(subtitles);

  return (
    spokenIn(byPosition, choice) ??
    spokenIn(byPosition, language) ??
    byPosition[0] ??
    null
  );
}
