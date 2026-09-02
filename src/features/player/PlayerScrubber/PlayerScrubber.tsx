import { formatClock } from '@/utils';
import { useDragScalar } from '../useDragScalar/useDragScalar';
import {
  Clock,
  Fill,
  Knob,
  Row,
  TotalClock,
  Track,
} from './PlayerScrubber.styles';

export interface PlayerScrubberProps {
  /** The **Absolute position** the film is at, in seconds. */
  position: number;
  /**
   * How long the film runs, from the **Playback read** by way of the screen
   * above. A prop rather than a lookup, because the component is
   * presentational — and it is never `video.duration` and never the record's
   * rounded, nullable `runtimeMinutes`, which is why a film the catalogue knows
   * no runtime for still gets a real, seekable bar.
   */
  duration: number;
  /** Take the film to a second. Called once, when the knob is let go. */
  onSeek: (seconds: number) => void;
}

/** How far along the bar a position sits, kept off the CSS's float noise. */
function percentOf(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

/**
 * The **Scrubber**: the track, its accent fill, the knob, and a clock either
 * side of it.
 *
 * **A drag moves the knob and the elapsed clock, and leaves the picture alone
 * until the knob is let go.** Seeking on every pointer move is the version of
 * this that fights the hand holding it, and on a stream path it is the version
 * that restarts ffmpeg forty times in a second. So the surface follows the
 * pointer — from `useDragScalar`'s scalar, which outranks the position prop
 * still arriving ten times a second underneath — and only the release seeks.
 *
 * A click is that drag with no movement in it, which is how a parent who taps
 * the bar gets where they tapped without knowing there is a knob at all.
 *
 * It shares `useDragScalar` with the volume slider and not one styled
 * component: the two differ in height, knob and colour, and a single `Slider`
 * primitive with a prop per difference is the thing being avoided.
 */
export function PlayerScrubber({
  position,
  duration,
  onSeek,
}: PlayerScrubberProps) {
  const { trackRef, value, onPointerDown } = useDragScalar({
    onCommit: (fraction) => onSeek(fraction * duration),
  });

  // A film with no length yet — the moment between the screen opening and the
  // playback read landing — is drawn empty rather than divided by nought.
  const played = duration > 0 ? position / duration : 0;
  const fraction = value ?? played;
  const percent = percentOf(fraction);

  return (
    <Row>
      <Clock>{formatClock(fraction * duration)}</Clock>
      <Track
        ref={trackRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={fraction * duration}
        aria-valuetext={formatClock(fraction * duration)}
        onPointerDown={onPointerDown}
      >
        <Fill $percent={percent} />
        <Knob $percent={percent} />
      </Track>
      <TotalClock>{formatClock(duration)}</TotalClock>
    </Row>
  );
}
