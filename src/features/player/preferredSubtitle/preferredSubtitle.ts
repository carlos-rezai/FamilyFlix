import type { Subtitle } from '@/types';

/**
 * Which of a film's **Subtitles** becomes the **Subtitle track** when CC is
 * pressed: the preferred language first, then track order.
 *
 * **Nobody chooses.** The prototype draws a plain CC toggle, and a picker
 * behind it would be new UI rather than a translation of one — which makes
 * determinism the property that matters. A film that opened in Portuguese
 * yesterday and English today would be something the family had no way to
 * correct, so the answer is a pure function of the rows and the preference, and
 * never of the order the rows happened to arrive in.
 *
 * The preference arrives from the opening settings read — the **Preferred
 * subtitle language** — and is optional because a refused read is no
 * preference, not English. `preferredAudio` is its twin.
 *
 * `null` for a film with no subtitle files, which is what the CC button not
 * being drawn at all is decided from.
 */
export function preferredSubtitle(
  subtitles: Subtitle[],
  language?: string
): Subtitle | null {
  // Track order, not arrival order: taking `subtitles[0]` would pass on a film
  // whose rows came back sorted and fail on the next one.
  const byPosition = [...subtitles].sort((a, b) => a.position - b.position);

  // The rows are whatever the importer wrote and a preference is whatever the
  // Settings dropdown handed over, so `EN` and `en` are one language.
  const spoken = language?.toLowerCase();
  const inLanguage = spoken
    ? byPosition.find((track) => track.language.toLowerCase() === spoken)
    : undefined;

  return inLanguage ?? byPosition[0] ?? null;
}
