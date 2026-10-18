import { useCallback, useRef, useState } from 'react';

import type { AudioTrack } from '@/types';
import { preferredAudio } from '../preferredAudio/preferredAudio';

export interface AudioTracksOptions {
  /** The offered **Audio tracks**, from the **Playback read** — empty until it lands. */
  tracks: AudioTrack[];
  /** The **Preferred audio language**, the track the film opens on. */
  language?: string;
  /**
   * The **Audio choice** carried from an earlier player in the sitting — read
   * ahead of `language`, but only where a track speaks it; else the usual rule.
   */
  choice?: string | null;
  /**
   * Told of every pick made by hand — a press or the `a` key — as the **Audio
   * choice**: the track's language, `null` for a track with none. Never told of
   * the track the film opens on, which nobody picked.
   */
  onChoice?: (language: string | null) => void;
}

export interface AudioTracksState {
  /** Every offered track, in index order. */
  tracks: AudioTrack[];
  /** The track playing, `null` for a film with none to offer. */
  playing: AudioTrack | null;
  /** Play the track pressed in the menu. */
  choose: (track: AudioTrack) => void;
  /** Move to the next track, wrapping from the last to the first. */
  next: () => void;
}

/**
 * The **Audio picker**'s state: the offered tracks, the one playing, and the
 * two ways a hand picks another. Until a pick, the playing track is
 * `preferredAudio`'s answer for the choice and the language handed — so
 * tracks that arrive late still open on the right one; after a pick, the pick
 * holds, which is the one thing decided here.
 */
export function useAudioTracks({
  tracks,
  language,
  choice,
  onChoice,
}: AudioTracksOptions): AudioTracksState {
  const [picked, setPicked] = useState<number | null>(null);

  const fromPick =
    picked === null
      ? undefined
      : tracks.find((track) => track.index === picked);
  const playing = fromPick ?? preferredAudio(tracks, language, choice);

  const latest = useRef({ tracks, playing, onChoice });
  latest.current = { tracks, playing, onChoice };

  const choose = useCallback((track: AudioTrack) => {
    setPicked(track.index);
    latest.current.onChoice?.(track.language);
  }, []);

  const next = useCallback(() => {
    const { tracks: offered, playing: current } = latest.current;
    if (offered.length === 0) {
      return;
    }
    const at = offered.findIndex((track) => track.index === current?.index);
    const following = offered[(at + 1) % offered.length];
    if (following !== undefined) {
      choose(following);
    }
  }, [choose]);

  return { tracks, playing, choose, next };
}
