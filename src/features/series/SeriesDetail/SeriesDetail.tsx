import { useNavigate, useParams } from 'react-router-dom';

import {
  CircleToggle,
  CreditsRow,
  DetailBackdrop,
  ExpandableText,
  SeasonCard,
} from '@/components';
import {
  Artwork,
  Button,
  CheckIcon,
  Chip,
  HeartIcon,
  HeartOutlineIcon,
} from '@/primitives';
import { episodePlayPath, seasonPath } from '@/utils';
import { LoadingSeries } from '../LoadingSeries/LoadingSeries';
import { SeriesEditMenu } from '../SeriesEditMenu/SeriesEditMenu';
import { SeriesMetaLine } from '../SeriesMetaLine/SeriesMetaLine';
import { useSeriesDetail } from '../useSeriesDetail/useSeriesDetail';
import {
  Content,
  Hero,
  PosterColumn,
  PosterFrame,
  TopTag,
  PosterTitle,
  Main,
  Title,
  Genres,
  ActionRow,
  Progress,
  SynopsisWrap,
  DetailMessage,
  SeasonsSection,
  SeasonsHeading,
  SeasonsGrid,
} from './SeriesDetail.styles';

/** The synopsis measure, from `page.SeriesPage.dc.html`. */
const SYNOPSIS_LINES = 4;
const SYNOPSIS_FONT_SIZE = 17;
const SYNOPSIS_MAX_WIDTH = 640;

/** The two circles' glyphs, from `page.SeriesPage.dc.html`. */
const CHECK_SIZE = 24;
const HEART_SIZE = 24;

/** The circles' tips and names, the movie page's words. */
const WATCHED_TIP = {
  on: 'Watched, click to unmark',
  off: 'Mark as watched',
};

const FAVORITE_TIP = {
  on: 'In Favorites, click to remove',
  off: 'Add to Favorites',
};

/**
 * The series page's organism: `page.SeriesPage`'s hero over one read of
 * `GET /api/series/:id` — the art, the title, a meta line of the **Year
 * range**, the counts and read-only stars, the genre chips, the one Resume /
 * Play button, the progress line, the synopsis and the credits. Everything it
 * draws was decided by `seriesView`.
 *
 * Under the hero, the Seasons grid: one Season card per season, each opening
 * its season page. Beside the button, the movie page's two circles — the
 * watched tick over every episode, then the series' heart — each shown at
 * once, put back if the save is refused. The button opens the player on the
 * episode it names, as a push.
 */
export function SeriesDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const detail = useSeriesDetail(id ?? '');

  if (detail.status === 'loading') {
    return <LoadingSeries />;
  }
  // The movie page's not-found face: a way back, and no Retry.
  if (detail.status === 'not-found') {
    return (
      <DetailMessage
        title="That series isn’t here"
        body="It may have been removed from your library."
        action={<Button label="Back to library" to="/" variant="secondary" />}
      />
    );
  }
  if (detail.status === 'error') {
    return (
      <DetailMessage
        title="Couldn’t load this series"
        body="Something went wrong reading it."
        action={
          <Button label="Retry" variant="secondary" onClick={detail.retry} />
        }
      />
    );
  }

  const { series } = detail;
  const playId = series.playEpisodeId;

  return (
    <>
      <DetailBackdrop url={series.backdropUrl} g1={series.g1} g2={series.g2} />
      <SeriesEditMenu
        seriesId={series.id}
        title={series.title}
        episodeCount={series.episodeCount}
      />

      <Content>
        <Hero>
          <PosterColumn>
            <PosterFrame>
              <Artwork
                poster
                url={series.posterUrl}
                g1={series.g1}
                g2={series.g2}
              />
              {series.hasPoster ? null : (
                <>
                  {series.topTag === null ? null : (
                    <TopTag>{series.topTag}</TopTag>
                  )}
                  <PosterTitle>{series.title}</PosterTitle>
                </>
              )}
            </PosterFrame>
          </PosterColumn>

          <Main>
            <Title>{series.title}</Title>

            <SeriesMetaLine
              yearLabel={series.yearLabel}
              countLabel={series.countLabel}
              ratingPercent={series.ratingPercent}
            />

            <Genres>
              {series.genres.map((genre) => (
                <Chip key={genre} label={genre} size="sm" />
              ))}
            </Genres>

            <ActionRow>
              <Button
                label={series.playLabel}
                variant="primary"
                size="lg"
                icon="play"
                onClick={
                  playId === null
                    ? undefined
                    : () => navigate(episodePlayPath(playId))
                }
              />
              <CircleToggle
                on={series.isWatched}
                label={series.isWatched ? WATCHED_TIP.on : WATCHED_TIP.off}
                onClick={detail.toggleWatched}
              >
                <CheckIcon size={CHECK_SIZE} />
              </CircleToggle>
              <CircleToggle
                on={series.isFavorite}
                label={series.isFavorite ? FAVORITE_TIP.on : FAVORITE_TIP.off}
                onClick={detail.toggleFavorite}
              >
                {series.isFavorite ? (
                  <HeartIcon size={HEART_SIZE} />
                ) : (
                  <HeartOutlineIcon size={HEART_SIZE} />
                )}
              </CircleToggle>
              <Progress>{series.progressLabel}</Progress>
            </ActionRow>

            {series.synopsis === null ? null : (
              <SynopsisWrap>
                <ExpandableText
                  text={series.synopsis}
                  lines={SYNOPSIS_LINES}
                  fontSize={SYNOPSIS_FONT_SIZE}
                  maxWidth={SYNOPSIS_MAX_WIDTH}
                />
              </SynopsisWrap>
            )}

            <CreditsRow
              leadLabel="Created by"
              lead={series.creator}
              castLabel="Starring"
              castText={series.castText}
              hasCredits={series.hasCredits}
            />
          </Main>
        </Hero>

        <SeasonsSection>
          <SeasonsHeading>Seasons</SeasonsHeading>
          <SeasonsGrid>
            {series.seasons.map((season) => (
              <SeasonCard
                key={season.number}
                season={season}
                onOpen={() => navigate(seasonPath(series.id, season.number))}
              />
            ))}
          </SeasonsGrid>
        </SeasonsSection>
      </Content>
    </>
  );
}
