import { Picture, Stage } from './Player.styles';

interface PlayerProps {
  /** The movie to play. The URL carries an id; the server resolves the path. */
  movieId: string;
}

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

/**
 * The player screen's picture.
 *
 * Deliberately almost nothing in this slice: a bare `<video>` pointed at the
 * stream route, driven by the browser's **own** controls. What this phase
 * promises is that bytes leave the disk and arrive in an element — our chrome,
 * the playback hook, the subtitle overlay and every piece of player state
 * arrive in the phases after it, inside this same component.
 *
 * The browser's controls are here for one phase only, and they are not a
 * placeholder for their own sake: without them the film is a picture nobody can
 * pause, and the point of the phase is that it can be checked by watching it.
 * `PlayerControls` replaces them.
 */
export function Player({ movieId }: PlayerProps) {
  return (
    <Stage>
      <Picture src={streamUrl(movieId)} controls />
    </Stage>
  );
}
