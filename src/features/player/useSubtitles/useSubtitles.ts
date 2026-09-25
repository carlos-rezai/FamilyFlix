import { useCallback, useEffect, useState } from 'react';

import type { Cue, Playable, Subtitle } from '@/types';
import { fetchSettings } from '@/api/fetchSettings/fetchSettings';

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
  /** The film or the episode playing — whose subtitle route the cues come off. */
  playable: Playable;
  /** The film's **Subtitles**, from the record. */
  subtitles: Subtitle[];
  /** The **Absolute position**, which is what a **Cue** is chosen against. */
  position: number;
}

/** The **Cue list** held for the session, stamped with the row it belongs to. */
interface HeldCues {
  trackId: string;
  list: Cue[];
}

/**
 * The whole of the **Player**'s subtitles: which track, whether it is showing,
 * and what line is on screen.
 *
 * Four pieces of state serving one feature, which is why they are one hook. The
 * track is chosen rather than picked — no picker ships — so it is the
 * deterministic answer `preferredSubtitle` gives from the household's
 * **Preferred subtitle language** then track order.
 *
 * **The preference is read once per open, and never waited for.** The settings
 * go out through the shared `fetchSettings` when the film opens; until they
 * land, and if they never do — refused, unreachable — the track is the first
 * in track order, exactly as before there was a preference to read. A
 * preference changed mid-film applies to the next film rather than switching
 * tracks under the family, which is what reading it once buys.
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
 * file has gone, and it must not read as "not fetched yet". The list is held
 * against the row it came from, so CC pressed before the settings land does not
 * leave the first row's lines under a later-chosen track.
 *
 * A fetch that fails outright is a film that plays on with no box. There is no
 * error state here to draw, and a bad subtitle file must never be able to
 * interrupt the film.
 */
export function useSubtitles(options: SubtitlesOptions): Subtitles {
  const {
    playable: { kind, id },
    subtitles,
    position,
  } = options;
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [cues, setCues] = useState<HeldCues | null>(null);
  const [language, setLanguage] = useState<string | undefined>(undefined);

  const track = preferredSubtitle(subtitles, language);

  const toggleSubtitles = useCallback(() => setSubtitlesOn((on) => !on), []);

  // Once per open: a preference changed mid-film is the next film's.
  useEffect(() => {
    let cancelled = false;
    void fetchSettings()
      .then((settings) => {
        if (!cancelled) {
          setLanguage(settings.subtitleLanguage);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  useEffect(() => {
    if (!subtitlesOn || track === null || cues?.trackId === track.id) {
      return;
    }

    let cancelled = false;
    void fetchSubtitleCues({ kind, id }, track.id)
      .then((list) => {
        if (!cancelled) {
          setCues({ trackId: track.id, list });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [kind, id, subtitlesOn, cues, track]);

  // The line on screen right now, or nothing — which the overlay draws as no
  // box at all rather than an empty one hovering over the picture.
  const line =
    subtitlesOn && track !== null && cues?.trackId === track.id
      ? (cueAt(cues.list, position)?.text ?? null)
      : null;

  return { track, subtitlesOn, line, toggleSubtitles };
}
