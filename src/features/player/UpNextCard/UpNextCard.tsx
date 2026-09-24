import type { NextEpisodeRef } from '@/types';
import { gradientFromId } from '@/utils';
import {
  Actions,
  Body,
  Cancel,
  Card,
  Code,
  Label,
  PlayNow,
  Thumb,
  Title,
} from './UpNextCard.styles';

export interface UpNextCardProps {
  /** The **Next episode**, as the episode read names it. */
  next: NextEpisodeRef;
  /** The whole seconds left in this file, already rounded up by the caller. */
  secondsLeft: number;
  onPlayNow: () => void;
  onCancel: () => void;
}

/** Two digits, as an episode code spells a season and an episode. */
const pad = (value: number) => String(value).padStart(2, '0');

/**
 * The **Up next card**, drawn 1:1 from the `showNextEp` block of
 * `feat.PlayerControls.dc.html`.
 *
 * Presentational: it is told the next episode and the seconds left, and hands
 * the two presses back. When it is shown, and what a press does, are the
 * `Player`'s.
 */
export function UpNextCard({
  next,
  secondsLeft,
  onPlayNow,
  onCancel,
}: UpNextCardProps) {
  const { g1, g2 } = gradientFromId(next.id);

  return (
    <Card>
      <Thumb $g1={g1} $g2={g2} aria-hidden="true" />
      <Body>
        <Label>{`Up next · in ${secondsLeft}s`}</Label>
        <Code>{`S${pad(next.season)}E${pad(next.number)}`}</Code>
        {next.title === null ? null : <Title>{next.title}</Title>}
        <Actions>
          <PlayNow type="button" onClick={onPlayNow}>
            Play now
          </PlayNow>
          <Cancel type="button" onClick={onCancel}>
            Cancel
          </Cancel>
        </Actions>
      </Body>
    </Card>
  );
}
