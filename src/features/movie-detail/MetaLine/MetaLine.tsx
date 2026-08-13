import { Fragment, type ReactNode } from 'react';

import { StarRating } from '@/primitives';
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
}

/** The stars sit at 20px on this page — larger than a card's 13px. */
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
 */
function metaSegments({
  year,
  runtimeLabel,
  ratingPercent,
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
  if (ratingPercent !== null) {
    segments.push({
      key: 'rating',
      node: (
        <RatingWrap>
          <StarRating rating={ratingPercent} size={STAR_SIZE} showValue />
        </RatingWrap>
      ),
    });
  }

  return segments;
}

/**
 * The **Meta line** under the movie's title: year, runtime, and stars, with a
 * bullet between each pair that survives, and the Watched badge at the end.
 *
 * The separators are interleaved rather than baked into a single string because
 * the stars sit in the middle of the line — no one string could hold them — and
 * because generating them *between* survivors is what makes a bullet with
 * nothing after it impossible to draw.
 *
 * It asks no display questions of its own: every `null` here was already
 * decided by `detailView`.
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
