import { useCallback, useEffect, useState } from 'react';

import type { Cue, Subtitle } from '@/types';

import { fetchSubtitleCues } from '../api/api';
import { cueAt } from '../cueAt/cueAt';
import { preferredSubtitle } from '../preferredSubtitle/preferredSubtitle';

/** What the **Player** needs to draw the CC pill and the **Subtitle overlay**. */
export interface Subtitles {
  /**
   * The **Subtitle track**, or `null` for a film with no rows — which is what
   * the CC pill's absence, and the C key's, are decided from.
   */
  track: Subtitle | null;
  /** Whether the box is showing. */
  subtitlesOn: boolean;
  /** The line covering the position right now, or `null` for no box at all. */
  line: string | null;
  /** Show the box, or stop showing it. */
  toggleSubtitles: () => void;
}

/** What the hook has to be told: which film, which rows, and where it is. */
export interface SubtitlesOptions {
  movieId: string;
  /** The film's **Subtitles**, from the record. */
  subtitles: Subtitle[];
  /** The **Absolute position**, which is what a **Cue** is chosen against. */
  position: number;
}

/**
 * The whole of the **Player**'s subtitles: which track, whether it is showing,
 * and what line is on screen.
 *
 * Four pieces of state serving one feature, which is why they are one hook. The
 * track is chosen rather than picked — no picker ships — so it is the
 * deterministic answer `preferredSubtitle` gives from the default language then
 * track order.
 *
 * **They start off on every film.** The prototype's `playMovie()` sets
 * `subsOn: true`; we ship them off, and that is a recorded divergence rather
 * than an oversight — auto-on subtitles are a roadmap item, and defaulting them
 * on would implement it by accident.
 *
 * **The Cue list is fetched once and held for the session.** Turning subtitles
 * off and on again does not re-ask, and neither does a seek: cues are stamped
 * in **Absolute position**, so there is nothing about a jump for them to be
 * re-stamped against. `null` until the list has been asked for is what keeps it
 * to one request — `[]` is a real answer, the file would not parse or the row's
 * file has gone, and it must not read as "not fetched yet".
 *
 * A fetch that fails outright is a film that plays on with no box. There is no
 * error state here to draw, and a bad subtitle file must never be able to
 * interrupt the film.
 */
export function useSubtitles({
  movieId,
  subtitles,
  position,
}: SubtitlesOptions): Subtitles {
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [cues, setCues] = useState<Cue[] | null>(null);

  const track = preferredSubtitle(subtitles);

  const toggleSubtitles = useCallback(() => setSubtitlesOn((on) => !on), []);

  useEffect(() => {
    if (!subtitlesOn || cues !== null || track === null) {
      return;
    }

    let cancelled = false;
    void fetchSubtitleCues(movieId, track.id)
      .then((list) => {
        if (!cancelled) {
          setCues(list);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [movieId, subtitlesOn, cues, track]);

  // The line on screen right now, or nothing — which the overlay draws as no
  // box at all rather than an empty one hovering over the picture.
  const line =
    subtitlesOn && cues !== null ? (cueAt(cues, position)?.text ?? null) : null;

  return { track, subtitlesOn, line, toggleSubtitles };
}
