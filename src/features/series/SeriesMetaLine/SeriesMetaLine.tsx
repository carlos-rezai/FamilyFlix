import { Fragment, type ReactNode } from 'react';

import type { RatingSource } from '@/types';
import { StarRating } from '@/primitives';
import { Root, MetaText, Separator } from './SeriesMetaLine.styles';

export interface SeriesMetaLineProps {
  /** The **Year range** — `2022`, `2019–2023`, `2021–` — or `null` with no year. */
  yearLabel: string | null;
  /** `2 seasons · 22 episodes`. */
  countLabel: string;
  /** 0–100 percent the read-only stars fill against; `null` when unrated. */
  ratingPercent: number | null;
  /** Whose rating the stars draw: `tmdb` is muted and tagged, `null` unrated. */
  ratingSource: RatingSource | null;
}

/** The read-only stars sit at 20px on this page, the movie page's size. */
const STAR_SIZE = 20;

/** Drawn between two surviving **Meta segments**, never beside a missing one. */
const META_SEPARATOR = '•';

/** The mark after a TMDB-drawn value — **TMDB-marked stars**. */
const TMDB_TAG = 'TMDB';

/** One item on the line, keyed so the interleaved separators stay stable. */
interface MetaSegment {
  key: string;
  node: ReactNode;
}

/**
 * The line's surviving segments, in order — `MetaLine`'s rule: the separators
 * are generated *between* them, so an absent segment cannot leave one behind.
 * The counts and the stars always survive; the year range is the one that can
 * be missing.
 */
function metaSegments({
  yearLabel,
  countLabel,
  ratingPercent,
  ratingSource,
}: SeriesMetaLineProps): MetaSegment[] {
  const isTmdb = ratingSource === 'tmdb';
  const segments: MetaSegment[] = [];
  if (yearLabel !== null) {
    segments.push({ key: 'year', node: <MetaText>{yearLabel}</MetaText> });
  }
  segments.push({ key: 'count', node: <MetaText>{countLabel}</MetaText> });
  segments.push({
    key: 'rating',
    node: (
      <StarRating
        rating={ratingPercent}
        size={STAR_SIZE}
        showValue
        muted={isTmdb}
        tag={isTmdb ? TMDB_TAG : undefined}
      />
    ),
  });
  return segments;
}

/**
 * The series page's meta line, `page.SeriesPage` 1:1: the **Year range**, the
 * season and episode counts, and the household's stars **read-only** — a
 * series is rated by the sheet, not from this page, so there is no picker and
 * no Watched badge. Its own unit rather than the movie's `MetaLine`, which is
 * built around both.
 */
export function SeriesMetaLine(props: SeriesMetaLineProps) {
  return (
    <Root>
      {metaSegments(props).map((segment, index) => (
        <Fragment key={segment.key}>
          {index > 0 ? <Separator>{META_SEPARATOR}</Separator> : null}
          {segment.node}
        </Fragment>
      ))}
    </Root>
  );
}
