import { Fragment, type ReactNode } from 'react';

import { RatingPicker } from '@/components';
import {
  Root,
  MetaText,
  Separator,
  RatingWrap,
  WatchedBadge,
} from './MetaLine.styles';

export interface MetaLineProps {
  /** The release year, or `null` when the record has none. */
  year: number | null;
  /** `2h 8m` / `42m`, or `null` when the runtime is unknown. */
  runtimeLabel: string | null;
  /** 0–100 percent the stars fill against; `null` when the movie is unrated. */
  ratingPercent: number | null;
  /** Closes the line with the Watched badge. */
  isWatched: boolean;
  /** The rating a click on the stars asks for, as a percent. */
  onRate: (percent: number | null) => void;
}

/** The picker's stars sit at 20px on this page — larger than a card's 13px. */
const STAR_SIZE = 20;

/** Drawn between two surviving **Meta segments**, never beside a missing one. */
const META_SEPARATOR = '•';

/** One item on the line, keyed so the interleaved separators stay stable. */
interface MetaSegment {
  key: string;
  node: ReactNode;
}

/**
 * The line's surviving segments, in order. Composing the list first is what
 * makes a dangling separator unrepresentable: the separators below are generated
 * *between* the members of this list, so an absent segment cannot leave one
 * behind. Every decision about what is absent was already made in `detailView`.
 *
 * The rating is the one segment that always survives. `year` and `runtimeLabel`
 * stay nullable, so the interleaving still has real work to do — but an unrated
 * movie is one the picker labels `Not rated`, not one the line leaves a hole
 * for, so a missing control can never mean "unrated" *or* "broken".
 */
function metaSegments({
  year,
  runtimeLabel,
  ratingPercent,
  onRate,
}: MetaLineProps): MetaSegment[] {
  const segments: MetaSegment[] = [];

  if (year !== null) {
    segments.push({ key: 'year', node: <MetaText>{year}</MetaText> });
  }
  if (runtimeLabel !== null) {
    segments.push({
      key: 'runtime',
      node: <MetaText>{runtimeLabel}</MetaText>,
    });
  }
  segments.push({
    key: 'rating',
    node: (
      <RatingWrap>
        <RatingPicker
          value={ratingPercent}
          size={STAR_SIZE}
          onChange={onRate}
        />
      </RatingWrap>
    ),
  });

  return segments;
}

/**
 * The **Meta line** under the movie's title: year, runtime, and the rating
 * picker, with a bullet between each pair that survives, and the Watched badge
 * at the end. The stars are the line's one interactive segment and its one
 * permanent one — the same twenty pixels in the same place they have always
 * held, except that a parent can now click them, whatever the movie's rating is.
 *
 * The separators are interleaved rather than baked into a single string because
 * the stars sit in the middle of the line — no one string could hold them — and
 * because generating them *between* survivors is what makes a bullet with
 * nothing after it impossible to draw.
 *
 * It asks no display questions of its own: every `null` here was already
 * decided by `detailView`, and a `null` rating is an unrated movie for the
 * picker to label rather than a segment to drop.
 */
export function MetaLine(props: MetaLineProps) {
  return (
    <Root>
      {metaSegments(props).map((segment, index) => (
        <Fragment key={segment.key}>
          {index > 0 ? <Separator>{META_SEPARATOR}</Separator> : null}
          {segment.node}
        </Fragment>
      ))}
      {props.isWatched ? <WatchedBadge>✓ Watched</WatchedBadge> : null}
    </Root>
  );
}
