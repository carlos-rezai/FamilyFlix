import { Artwork } from '@/primitives';
import { useImageFallback } from '@/hooks/useImageFallback/useImageFallback';
import type { NextEpisodeRef } from '@/types';
import { formatEpisodeTag, gradientFromId, imageUrl } from '@/utils';
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

/**
 * The **Up next card**, drawn 1:1 from the `showNextEp` block of
 * `feat.PlayerControls.dc.html`.
 *
 * Presentational: it is told the next episode and the seconds left, and hands
 * the two presses back. The thumbnail is the next episode's **Still**, drawn as
 * an image edge to edge over its gradient, and the gradient alone when it has
 * none. When it is shown, and what a press does, are the `Player`'s.
 */
export function UpNextCard({
  next,
  secondsLeft,
  onPlayNow,
  onCancel,
}: UpNextCardProps) {
  const { g1, g2 } = gradientFromId(next.id);
  const nextStillUrl = imageUrl(next.stillPath);
  const { url: stillUrl, onError } = useImageFallback(nextStillUrl);

  return (
    <Card>
      <Thumb $g1={g1} $g2={g2} aria-hidden="true">
        {stillUrl ? (
          <Artwork image url={stillUrl} g1={g1} g2={g2} onError={onError} />
        ) : null}
      </Thumb>
      <Body>
        <Label>{`Up next · in ${secondsLeft}s`}</Label>
        <Code>{formatEpisodeTag(next)}</Code>
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
