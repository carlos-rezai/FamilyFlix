import { useCallback, useEffect, useRef, useState } from 'react';

import { saveEpisodeWatched } from '@/api/saveEpisodeWatched/saveEpisodeWatched';
import type { EpisodeRead, NextEpisodeRef } from '@/types';
import { episodePlayPath } from '@/utils';

/** How close to the end of an episode the **Up next card** appears. */
const UP_NEXT_SECONDS = 15;

/** What the rules read: the episode playing, and where its file is. */
export interface UpNextOptions {
  /** The episode's read — its **Next episode** among it — or absent for a film. */
  episode: EpisodeRead | undefined;
  /** The **Absolute position**. */
  position: number;
  /** How long the file runs, from the **Playback read**. */
  duration: number;
  /** Whether the file has reached its end. */
  ended: boolean;
  /** The router's navigate: moving on is a `replace`. */
  navigate: (to: string, options: { replace: true }) => void;
  /** The player's one way out, by the **Back rule**. */
  leave: () => void;
}

/** What the screen draws from, and the card's two answers. */
export interface UpNext {
  /** The episode the card offers, or `null` — none, or cancelled. */
  upNext: NextEpisodeRef | null;
  /** The whole seconds left in the file, rounded up. */
  secondsLeft: number;
  /** Whether the card is on screen. */
  showUpNext: boolean;
  /** _Play now_: this episode marked watched, then the next one. */
  playNow: () => void;
  /** _Cancel_: no card and no auto-play, for this episode only. */
  cancel: () => void;
}

/**
 * **Up next**: the player's one addition for an **Episode**, its rules in one
 * place.
 *
 * - The card shows while there is a **Next episode**, the family has not
 *   cancelled it, and 15 seconds or less of the file remain — counted rounded
 *   up, so the last fraction of a second still reads 1.
 * - _Play now_ marks this episode watched — best-effort: the family has
 *   already moved on, and a refused write leaves nothing on this screen to put
 *   back — and moves on.
 * - _Cancel_ holds for the episode it was pressed on, and no other.
 * - At the end of the file, a next episode not cancelled plays; no next
 *   episode leaves, to the season page by the **Back rule**; a cancelled one
 *   stays where it is.
 *
 * Moving on is always a **Sideways move** — a `replace` — so a run of episodes
 * leaves one entry behind, and Back reaches the season page.
 *
 * Only the moment the file ends decides; a change of mind after it does not.
 * The effect is keyed on `ended` alone and reads everything else through a ref
 * to the latest values, rather than listing them and re-deciding on each.
 */
export function useUpNext({
  episode,
  position,
  duration,
  ended,
  navigate,
  leave,
}: UpNextOptions): UpNext {
  const episodeId = episode?.episode.id ?? null;
  const next = episode?.next ?? null;

  // Cancelled *for this episode*: held against its id, so the next episode
  // arrives uncancelled whether or not the screen is remounted for it.
  const [cancelledFor, setCancelledFor] = useState<string | null>(null);
  const cancelled = episodeId !== null && cancelledFor === episodeId;

  const upNext = cancelled ? null : next;
  const secondsLeft = Math.ceil(duration - position);
  const showUpNext =
    upNext !== null &&
    duration > 0 &&
    secondsLeft > 0 &&
    secondsLeft <= UP_NEXT_SECONDS;

  const playNext = useCallback(
    (nextId: string) => navigate(episodePlayPath(nextId), { replace: true }),
    [navigate]
  );

  const playNow = useCallback(() => {
    if (episodeId === null || upNext === null) {
      return;
    }
    saveEpisodeWatched(episodeId, true).catch(() => undefined);
    playNext(upNext.id);
  }, [episodeId, upNext, playNext]);

  const cancel = useCallback(() => setCancelledFor(episodeId), [episodeId]);

  const latest = useRef({ episode, next, cancelled, playNext, leave });
  latest.current = { episode, next, cancelled, playNext, leave };

  useEffect(() => {
    const now = latest.current;
    if (!ended || now.episode === undefined) {
      return;
    }
    if (now.next === null) {
      now.leave();
      return;
    }
    if (!now.cancelled) {
      now.playNext(now.next.id);
    }
  }, [ended]);

  return { upNext, secondsLeft, showUpNext, playNow, cancel };
}
