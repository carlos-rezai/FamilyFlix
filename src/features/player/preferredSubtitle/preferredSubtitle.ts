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
 * The preference itself has no source yet — the Settings default-language
 * dropdown is a later initiative — so it is optional and every call today omits
 * it. It is here rather than added later because the fallback is the
 * interesting half, and it only reads as a fallback if there is something to
 * fall back from.
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

  // The rows are whatever the importer wrote and a preference is whatever a
  // dropdown will later hand over, so `EN` and `en` are one language.
  const spoken = language?.toLowerCase();
  const inLanguage = spoken
    ? byPosition.find((track) => track.language.toLowerCase() === spoken)
    : undefined;

  return inLanguage ?? byPosition[0] ?? null;
}
