import { useEffect, useState } from 'react';

import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import type { Movie, PlaybackRead } from '@/types';

import { fetchPlayback } from '../api/api';

/** What the **Player** knows about the film before a byte of it arrives. */
export interface OpeningReads {
  /** The record — the name, the artwork, and where the film was left. */
  movie: Movie | null;
  /** The **Playback read** — the path the film takes and how long it runs. */
  playback: PlaybackRead | null;
  /** Whether there is no file behind the row, which is its own notice. */
  fileMissing: boolean;
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
 * one, and `fetchPlayback` resolves that as `null` precisely so it can be told
 * apart from a request that went wrong — which is what makes the missing-file
 * notice reachable. A read that failed outright is the other thing: there is no
 * notice for it, and the screen keeps its backdrop rather than falling over.
 */
export function useOpeningReads(movieId: string): OpeningReads {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [playback, setPlayback] = useState<PlaybackRead | null>(null);
  const [fileMissing, setFileMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchMovie(movieId), fetchPlayback(movieId)])
      .then(([record, read]) => {
        if (cancelled) {
          return;
        }
        setMovie(record);
        setPlayback(read);
        // The playback read answers 404 for a film with no file behind it, and
        // `fetchPlayback` resolves that as `null` precisely so it can be told
        // apart from a request that went wrong.
        setFileMissing(read === null);
      })
      // A read that failed outright is not a film with no file, and the notice
      // for it arrives with the transcoding paths. Until then the screen keeps
      // its backdrop rather than falling over.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [movieId]);

  return { movie, playback, fileMissing };
}
