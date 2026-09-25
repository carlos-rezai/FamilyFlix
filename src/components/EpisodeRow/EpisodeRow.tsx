import type { KeyboardEvent, MouseEvent } from 'react';

import { PlayIcon, ProgressBar } from '@/primitives';
import type { EpisodeRowEpisode } from '@/types';
import { formatEpisodeTag } from '@/utils';
import {
  Root,
  Thumb,
  PlayHover,
  PlayDisc,
  ProgressWrap,
  Body,
  Heading,
  Code,
  Title,
  Line,
  ResumeLine,
  WatchedBox,
} from './EpisodeRow.styles';

export interface EpisodeRowProps {
  episode: EpisodeRowEpisode;
  /** Open the episode. */
  onOpen: () => void;
  /** Flip the episode's watched mark. */
  onToggleWatched: () => void;
}

const ACTIVATION_KEYS = ['Enter', ' '];

/**
 * One episode on the season page — `mol.EpisodeRow` 1:1. The 16:9 thumbnail
 * in the series' gradient with a hover play glyph and the resume bar, the
 * `S02E04` code and title over the air date and the **Resume label**, then the
 * watched box. The row is a **Card** (`cardLift`, `cardFocus`) and one tab
 * stop; the box is a **Control** and a tab stop of its own that only marks.
 * Presentational — it knows no route and saves nothing.
 */
export function EpisodeRow({
  episode,
  onOpen,
  onToggleWatched,
}: EpisodeRowProps) {
  const code = formatEpisodeTag(episode);
  const title = episode.title || 'Untitled episode';
  const inProgress =
    !episode.watched && episode.progress > 0 && episode.progress < 100;

  const handleOpenKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!ACTIVATION_KEYS.includes(event.key)) return;
    event.preventDefault();
    onOpen();
  };

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleWatched();
  };

  // The box sits inside the row's key handler: an activation key on it must
  // not bubble up and open the episode as well.
  const handleToggleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (ACTIVATION_KEYS.includes(event.key)) event.stopPropagation();
  };

  const tip = episode.watched ? 'Watched — click to unmark' : 'Mark as watched';

  return (
    <Root
      role="button"
      tabIndex={0}
      aria-label={`${code} ${title}`}
      onClick={onOpen}
      onKeyDown={handleOpenKey}
    >
      <Thumb $g1={episode.g1} $g2={episode.g2}>
        <PlayHover aria-hidden="true">
          <PlayDisc>
            <PlayIcon size={20} />
          </PlayDisc>
        </PlayHover>
        {inProgress ? (
          <ProgressWrap>
            <ProgressBar percent={episode.progress} height={4} track />
          </ProgressWrap>
        ) : null}
      </Thumb>
      <Body>
        <Heading>
          <Code>{code}</Code>
          <Title>{title}</Title>
        </Heading>
        {episode.airDate ? <Line>{episode.airDate}</Line> : null}
        {episode.resumeLabel ? (
          <ResumeLine>{episode.resumeLabel}</ResumeLine>
        ) : null}
      </Body>
      <WatchedBox
        type="button"
        title={tip}
        aria-label={tip}
        aria-pressed={episode.watched}
        $watched={episode.watched}
        onClick={handleToggle}
        onKeyDown={handleToggleKey}
      >
        {episode.watched ? '✓' : ''}
      </WatchedBox>
    </Root>
  );
}
