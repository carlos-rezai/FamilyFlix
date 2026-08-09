import { PlayIcon, ProgressBar } from '@/primitives';
import type { ContinueCardMovie } from '@/types';
import {
  Root,
  Tile,
  Art,
  Scrim,
  TextWrap,
  Title,
  ResumeLabel,
  TrackWrap,
  PlayBadge,
} from './ContinueCard.styles';

export interface ContinueCardProps {
  movie: ContinueCardMovie;
  /** Open the movie (resume playback from its saved position). */
  onOpen: () => void;
}

/**
 * The wide 16:10 resume tile for the Continue Watching row — a deterministic
 * gradient under a dark scrim, the title and its finished resume label, a 4px
 * accent progress track pinned to the bottom edge, and a play badge top-right.
 * Read-only by design: no favorite control, one `onOpen`. Presentational — the
 * label and percent arrive ready-made on the `ContinueCardMovie`.
 *
 * The tile is a single button (see `Root`), labelled with the movie's title
 * rather than by its contents: read as content it would announce as "Comet
 * Season Resume · 1:13 of 1:55", and the resume label is progress information
 * for the eye, not part of what the control is called.
 */
export function ContinueCard({ movie, onOpen }: ContinueCardProps) {
  return (
    <Root type="button" aria-label={movie.title} onClick={onOpen}>
      <Tile>
        <Art $g1={movie.g1} $g2={movie.g2} />
        <Scrim />
        <TextWrap>
          <Title>{movie.title}</Title>
          <ResumeLabel>{movie.resumeLabel}</ResumeLabel>
        </TextWrap>
        <TrackWrap>
          <ProgressBar percent={movie.progress} height={4} track={false} />
        </TrackWrap>
        <PlayBadge>
          <PlayIcon size={16} />
        </PlayBadge>
      </Tile>
    </Root>
  );
}
