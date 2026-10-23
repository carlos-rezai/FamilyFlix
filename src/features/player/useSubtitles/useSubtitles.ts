import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Cue, Playable, Subtitle } from '@/types';

import { fetchSubtitleCues } from '../api/api';
import { cueAt } from '../cueAt/cueAt';
import { preferredSubtitle } from '../preferredSubtitle/preferredSubtitle';

/** What the **Player** needs to draw the CC pill, its picker and the **Subtitle overlay**. */
export interface Subtitles {
  /** The film's **Subtitles** in track order: the picker's rows. */
  subtitles: Subtitle[];
  /**
   * The **Subtitle track**, or `null` for a film with no rows, which is what
   * the CC pill's absence, and the C key's, are decided from.
   */
  track: Subtitle | null;
  /** Whether there is a choice to make: two rows or more. */
  hasSubtitlePicker: boolean;
  /** Whether the box is showing. */
  subtitlesOn: boolean;
  /** The line covering the position right now, or `null` for no box at all. */
  line: string | null;
  /** Show the box, or stop showing it, over the current track. */
  toggleSubtitles: () => void;
  /** Show a row and turn subtitles on, or turn them off with `null`. */
  choose: (subtitle: Subtitle | null) => void;
}

/** What the hook has to be told: which film, which rows, and where it is. */
export interface SubtitlesOptions {
  /** The film or the episode playing, whose subtitle route the cues come off. */
  playable: Playable;
  /** The film's **Subtitles**, from the record. */
  subtitles: Subtitle[];
  /** The **Absolute position**, which is what a **Cue** is chosen against. */
  position: number;
  /**
   * The **Preferred subtitle language**, off the player's opening settings
   * read: `undefined` while it has not landed, and for a read refused.
   */
  language?: string;
  /**
   * The **Subtitle choice** carried from an earlier player in the sitting: a
   * language opens subtitles on, on the row `preferredSubtitle` answers for
   * it; `null` (chosen off) or absent opens them off.
   */
  choice?: string | null;
  /**
   * Told of every hand action as the new **Subtitle choice**: the showing
   * track's language, or `null` for off. Never told at open.
   */
  onChoice?: (language: string | null) => void;
}

/**
 * The whole of the **Player**'s subtitles: which track, whether it is showing,
 * and what line is on screen.
 *
 * Until a row is picked by hand the track is the deterministic answer
 * `preferredSubtitle` gives from the sitting's **Subtitle choice**, the
 * household's **Preferred subtitle language**, then track order.
 * `choose(subtitle)` shows that row and turns subtitles on; `choose(null)`
 * turns them off. The last hand pick is the track `toggleSubtitles` flips over
 * from then on, for the rest of this open.
 *
 * **The preference is handed in, never fetched here.** The player's opening
 * read is the one `GET /api/settings` an open makes; without a preference
 * (refused, unreachable) the track is the first in track order.
 *
 * **They start off without a choice.** The prototype's `playMovie()` sets
 * `subsOn: true`; we open them off unless the sitting's **Subtitle choice** is
 * a language, and that is a recorded divergence rather than an oversight:
 * auto-on subtitles are a roadmap item, and defaulting them on would
 * implement it by accident. Every hand action (`choose`, the toggle) is
 * reported through `onChoice`; an open is not a hand action.
 *
 * **A Cue list is fetched once per track and held for this open**, keyed by
 * Subtitle id. Switching back to a track already read asks nothing, and
 * neither does a seek: cues are stamped in **Absolute position**. Lines are
 * fetched only while on, and only for the showing track. A list that lands for
 * a track no longer showing is kept but never drawn, since only the showing
 * track's list is read for the line. `[]` is a real answer (the file would not
 * parse, or the row's file has gone) and is held like any other.
 *
 * A fetch that fails outright is a track that plays on with no box. There is
 * no error state here to draw, and a bad subtitle file must never be able to
 * interrupt the film.
 */
export function useSubtitles(options: SubtitlesOptions): Subtitles {
  const {
    playable: { kind, id },
    subtitles: rows,
    position,
    language,
    choice,
    onChoice,
  } = options;
  // `null` until a hand action: until then the box opens as the sitting's
  // choice says, read once the rows have landed rather than at first render.
  const [handOn, setHandOn] = useState<boolean | null>(null);
  const subtitlesOn = handOn ?? (typeof choice === 'string' && rows.length > 0);
  // The id of the row last picked by hand, as `useAudioTracks` holds an index.
  const [picked, setPicked] = useState<string | null>(null);
  const [cues, setCues] = useState<ReadonlyMap<string, Cue[]>>(new Map());
  // Every track asked for this open, landed or not, so a list in flight is
  // never asked for twice.
  const asked = useRef(new Set<string>());

  const subtitles = useMemo(
    () => [...rows].sort((a, b) => a.position - b.position),
    [rows]
  );

  const fromPick =
    picked === null
      ? undefined
      : subtitles.find((subtitle) => subtitle.id === picked);
  const track = fromPick ?? preferredSubtitle(subtitles, language, choice);

  // The callbacks stay stable while reading what is showing now.
  const latest = useRef({ track, subtitlesOn, onChoice });
  latest.current = { track, subtitlesOn, onChoice };

  const toggleSubtitles = useCallback(() => {
    const { track: showing, subtitlesOn: on, onChoice: tell } = latest.current;
    setHandOn(!on);
    tell?.(on ? null : (showing?.language ?? null));
  }, []);

  const choose = useCallback((subtitle: Subtitle | null) => {
    if (subtitle === null) {
      setHandOn(false);
      latest.current.onChoice?.(null);
      return;
    }
    setPicked(subtitle.id);
    setHandOn(true);
    latest.current.onChoice?.(subtitle.language);
  }, []);

  const trackId = track?.id ?? null;

  useEffect(() => {
    if (!subtitlesOn || trackId === null || asked.current.has(trackId)) {
      return;
    }

    asked.current.add(trackId);
    void fetchSubtitleCues({ kind, id }, trackId)
      .then((list) => {
        setCues((held) => new Map(held).set(trackId, list));
      })
      .catch(() => undefined);
  }, [kind, id, subtitlesOn, trackId]);

  // The line on screen right now, or nothing, which the overlay draws as no
  // box at all rather than an empty one hovering over the picture.
  const list = trackId === null ? undefined : cues.get(trackId);
  const line =
    subtitlesOn && list !== undefined
      ? (cueAt(list, position)?.text ?? null)
      : null;

  return {
    subtitles,
    track,
    hasSubtitlePicker: subtitles.length >= 2,
    subtitlesOn,
    line,
    toggleSubtitles,
    choose,
  };
}
