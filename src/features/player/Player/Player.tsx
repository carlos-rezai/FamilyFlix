import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchMovie } from '@/api/fetchMovie/fetchMovie';
import type { Movie, PlaybackRead } from '@/types';
import { gradientFromId } from '@/utils';
import { fetchPlayback } from '../api/api';
import { PlayerControls } from '../PlayerControls/PlayerControls';
import { PlayerNotice } from '../PlayerNotice/PlayerNotice';
import type { PlayerNoticeKind } from '../PlayerNotice/PlayerNotice';
import { useControlsVisibility } from '../useControlsVisibility/useControlsVisibility';
import { usePlayback } from '../usePlayback/usePlayback';
import {
  ArtLayer,
  Backdrop,
  Centre,
  Picture,
  PictureLayer,
  Scrim,
  Stage,
} from './Player.styles';

interface PlayerProps {
  /** The movie to play. The URL carries an id; the server resolves the path. */
  movieId: string;
}

/** Path prefix for the Express route that streams managed poster images. */
const IMAGE_ROUTE = '/api/images/';

/**
 * The stream a movie's bytes arrive on.
 *
 * The id is encoded rather than interpolated raw: it has to arrive as one path
 * segment however it is spelled. Ids are minted by the repository today, so
 * this is a guard rather than a case the app produces — but it is the kind of
 * guard that is free here and expensive once a route is live.
 */
function streamUrl(movieId: string): string {
  return `/api/movies/${encodeURIComponent(movieId)}/stream`;
}

/** Where the film's page is, which is where both ways out of the player land. */
function moviePath(movieId: string): string {
  return `/movie/${encodeURIComponent(movieId)}`;
}

/**
 * What the centre of the picture is saying, or nothing at all when the film is
 * simply running.
 *
 * The order is the order the answers matter in: a film with no file behind it
 * is not buffering, and a film waiting for bytes is not stopped. `null` is the
 * only state that draws nothing, and it is the one the player is in for almost
 * all of its life.
 */
function noticeFor(
  fileMissing: boolean,
  buffering: boolean,
  playing: boolean
): PlayerNoticeKind | null {
  if (fileMissing) {
    return 'missing-file';
  }
  if (buffering) {
    return 'buffering';
  }
  return playing ? null : 'play';
}

/**
 * The player screen: the film, our **Chrome** over it, and whatever the centre
 * of the picture has to say.
 *
 * It owns the two reads the screen opens with — the movie record, for the name
 * and the artwork, and the **Playback read**, for the path and the duration —
 * and hands everything else to a hook: `usePlayback` binds the element,
 * `useControlsVisibility` decides whether the chrome is on screen, and the two
 * components below draw what they are told.
 *
 * **The screen is never a flat black rectangle.** The blurred backdrop is drawn
 * from the id's own gradient before either read has landed, and a film whose
 * file is missing gets the notice that says so rather than a picture that will
 * never arrive.
 *
 * There is one way out, reached two ways: the Back pill and Escape both call
 * {@link leave}, because two ways out with two handlers are two behaviours to
 * keep in step forever.
 */
export function Player({ movieId }: PlayerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const { playing, buffering, toggle } = usePlayback(videoRef, playback);

  const notice = noticeFor(fileMissing, buffering, playing);

  // Two different things hold the chrome on screen, and only one of them is
  // about playback: a paused film is someone deciding, and a notice's only way
  // out is the Back pill inside the chrome.
  const { visible, onMouseMove } = useControlsVisibility(
    playing && notice === null
  );

  const leave = useCallback(() => {
    navigate(moviePath(movieId));
  }, [navigate, movieId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        leave();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [leave]);

  const { g1, g2 } = gradientFromId(movieId);

  return (
    <Stage $idle={!visible} onMouseMove={onMouseMove}>
      <ArtLayer aria-hidden="true">
        <Backdrop
          url={movie?.posterPath ? `${IMAGE_ROUTE}${movie.posterPath}` : null}
          g1={g1}
          g2={g2}
        />
        <Scrim />
      </ArtLayer>

      <PictureLayer onClick={toggle}>
        {fileMissing ? null : (
          <Picture ref={videoRef} src={streamUrl(movieId)} />
        )}
        {notice === null ? null : (
          <Centre>
            <PlayerNotice kind={notice} />
          </Centre>
        )}
      </PictureLayer>

      <PlayerControls
        title={movie?.title ?? ''}
        visible={visible}
        playing={playing}
        onBack={leave}
        onTogglePlay={toggle}
      />
    </Stage>
  );
}
