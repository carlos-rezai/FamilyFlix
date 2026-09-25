import { Artwork, ProgressBar, StatusBadge } from '@/primitives';
import type { SeasonCardSeason } from '@/types';
import { formatEpisodeTag } from '@/utils';
import {
  Root,
  Tile,
  Numeral,
  BadgeWrap,
  ProgressWrap,
  Label,
  SubLabel,
} from './SeasonCard.styles';

export interface SeasonCardProps {
  season: SeasonCardSeason;
  /** Open the season's page. */
  onOpen: () => void;
}

/**
 * One season on the series page — `mol.SeasonCard` 1:1. A 2:3 tile in the
 * series' gradient with the `S02` numeral, the StatusBadge when every episode
 * is watched and a ProgressBar when some are; under it _Season N_ over
 * "8 episodes" or "3 of 8 watched". A **Card**: `cardLift` on the tile,
 * `cardFocus` on the root. Presentational — it knows no route.
 */
export function SeasonCard({ season, onOpen }: SeasonCardProps) {
  const { number, label, episodeCount: total, watchedCount: watched } = season;
  const complete = total > 0 && watched >= total;
  const inProgress = watched > 0 && watched < total;
  const percent = total ? Math.round((watched / total) * 100) : 0;
  const subLabel = inProgress
    ? `${watched} of ${total} watched`
    : `${total} episode${total === 1 ? '' : 's'}`;

  return (
    <Root type="button" onClick={onOpen}>
      <Tile>
        <Artwork g1={season.g1} g2={season.g2} />
        <Numeral>{formatEpisodeTag({ season: number })}</Numeral>
        {complete ? (
          <BadgeWrap>
            <StatusBadge size={26} />
          </BadgeWrap>
        ) : null}
        {inProgress ? (
          <ProgressWrap>
            <ProgressBar percent={percent} height={4} track />
          </ProgressWrap>
        ) : null}
      </Tile>
      <Label>{label || `Season ${number}`}</Label>
      <SubLabel>{subLabel}</SubLabel>
    </Root>
  );
}
