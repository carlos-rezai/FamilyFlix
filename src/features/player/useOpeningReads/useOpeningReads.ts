import { useEffect, useState } from 'react';

import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import type { EpisodeRead, Movie, PlaybackRead, Playable } from '@/types';

import { fetchEpisode, fetchPlayback } from '../api/api';
import type { PlayerNoticeKind } from '../PlayerNotice/PlayerNotice';

/**
 * Why there is nothing to play, in **PlayerNotice**'s own words: no file
 * behind the row, or a **Library folder** out of reach.
 */
export type Unavailable = Extract<
  PlayerNoticeKind,
  'missing-file' | 'unreachable'
>;

/** What the **Player** knows about the film before a byte of it arrives. */
export interface OpeningReads {
  /** The record — the name, the artwork, and where the film was left. */
  movie: Movie | null;
  /**
   * The episode's record in its place when an **Episode** is playing — the
   * episode, its series, its next — and absent for a movie, or until it lands.
   */
  episode?: EpisodeRead;
  /** The **Playback read** — the path the film takes and how long it runs. */
  playback: PlaybackRead | null;
  /**
   * Why there is nothing to play, or `null`: `missing-file`, the read's `404`
   * — no file behind the row — or `unreachable`, its `503` — the film's
   * **Library folder** out of reach, never a missing file. Each is its own
   * notice.
   */
  unavailable: Unavailable | null;
  /**
   * Whether both reads have **settled** — however they settled.
   *
   * Not "the reads have values": a read that went wrong leaves `playback` null
   * for good, which is the very null it holds before the read lands, so a
   * screen gated on a value would wait for the rest of the evening. This is the
   * third thing `unavailable` cannot carry — it is `null` before the read
   * answers and `null` for a film that plays, so it cannot tell "not yet"
   * from "fine".
   */
  opened: boolean;
}

/**
 * The two reads the **Player** opens with, made together and reported as one.
 *
 * They are one hook because they are one moment: the screen has nothing to draw
 * until both have answered, and every caller wants all four of these or none of
 * them. `Promise.all` rather than two awaits, so the slower of the two is the
 * wait rather than the sum.
 *
 * **A film with no file is not an error.** The playback read answers 404 for
 * one, and `fetchPlayback` resolves that as `missing` precisely so it can be
 * told apart from a request that went wrong — which is what makes the missing-file
 * notice reachable. A read that failed outright is the other thing: there is no
 * notice for it, and the screen keeps its backdrop rather than falling over.
 * It is nonetheless {@link OpeningReads.opened} — settled is settled, and the
 * screen has to stop waiting on an answer that is never coming.
 */
export function useOpeningReads({ kind, id }: Playable): OpeningReads {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [episode, setEpisode] = useState<EpisodeRead | undefined>(undefined);
  const [playback, setPlayback] = useState<PlaybackRead | null>(null);
  const [unavailable, setUnavailable] = useState<Unavailable | null>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOpened(false);

    // The record comes off the playable's own wire: a movie's, or an
    // episode's read with its series beside it.
    const record =
      kind === 'episode'
        ? fetchEpisode(id).then((read) => ({
            movie: null,
            episode: read ?? undefined,
          }))
        : fetchMovie(id).then((read) => ({ movie: read, episode: undefined }));

    // A file missing and a folder out of reach are answers, so they settle
    // the pair rather than failing it: the record is still reported beside.
    const read = fetchPlayback({ kind, id });

    void Promise.all([record, read])
      .then(([records, answer]) => {
        if (cancelled) {
          return;
        }
        setMovie(records.movie);
        setEpisode(records.episode);
        setPlayback(answer.kind === 'read' ? answer.read : null);
        setUnavailable(
          answer.kind === 'missing'
            ? 'missing-file'
            : answer.kind === 'unreachable'
              ? 'unreachable'
              : null
        );
      })
      // A read that failed outright is not a film with no file, and the notice
      // for it arrives with the transcoding paths. Until then the screen keeps
      // its backdrop rather than falling over.
      .catch(() => undefined)
      // Whichever of the three ways the pair settled — answered, 404, or gone
      // wrong — there is no longer an answer coming, and the screen may stop
      // waiting on one.
      .finally(() => {
        if (!cancelled) {
          setOpened(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  return { movie, episode, playback, unavailable, opened };
}
