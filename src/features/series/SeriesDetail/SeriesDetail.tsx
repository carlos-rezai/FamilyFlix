import { Fragment, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { CreditsRow, ExpandableText, SeasonCard } from '@/components';
import {
  Artwork,
  Button,
  Chip,
  HeartIcon,
  HeartOutlineIcon,
  StarRating,
} from '@/primitives';
import type { SeriesDetailModel } from '@/types';
import { range, seasonPath } from '@/utils';
import { useSeriesDetail } from '../useSeriesDetail/useSeriesDetail';
import {
  ArtArea,
  Scrim,
  Content,
  Hero,
  PosterColumn,
  PosterFrame,
  TopTag,
  PosterTitle,
  Main,
  Title,
  Meta,
  MetaText,
  Separator,
  Genres,
  ActionRow,
  CircleToggle,
  Progress,
  SynopsisWrap,
  DetailMessage,
  SkeletonPoster,
  SkeletonTitle,
  SkeletonLine,
  SeasonsSection,
  SeasonsHeading,
  SeasonsGrid,
} from './SeriesDetail.styles';

/** The synopsis measure, from `page.SeriesPage.dc.html`. */
const SYNOPSIS_LINES = 4;
const SYNOPSIS_FONT_SIZE = 17;
const SYNOPSIS_MAX_WIDTH = 640;

/** The read-only stars sit at 20px on this page, the movie page's size. */
const STAR_SIZE = 20;

/** Drawn between two surviving **Meta segments**, never beside a missing one. */
const META_SEPARATOR = '•';

/** The heart's circle and glyph, from `page.SeriesPage.dc.html`. */
const CIRCLE_SIZE = 58;
const HEART_SIZE = 24;

/** The heart's tip and name, the movie page's words. */
const FAVORITE_TIP = {
  on: 'In Favorites — click to remove',
  off: 'Add to Favorites',
};

/** Placeholder lines held while the series loads. */
const SKELETON_LINES = 3;

/** The line's surviving segments; the separators are generated between them. */
function metaSegments(series: SeriesDetailModel) {
  const segments: { key: string; node: ReactNode }[] = [];
  if (series.yearLabel !== null) {
    segments.push({
      key: 'year',
      node: <MetaText>{series.yearLabel}</MetaText>,
    });
  }
  segments.push({
    key: 'count',
    node: <MetaText>{series.countLabel}</MetaText>,
  });
  segments.push({
    key: 'rating',
    node: (
      <StarRating rating={series.ratingPercent} size={STAR_SIZE} showValue />
    ),
  });
  return segments;
}

/** The page's shape, held while the series loads. */
function LoadingSeries() {
  return (
    <Content role="status" aria-label="Loading series">
      <Hero aria-hidden="true">
        <PosterColumn>
          <SkeletonPoster />
        </PosterColumn>
        <Main>
          <SkeletonTitle />
          {range(SKELETON_LINES).map((line) => (
            <SkeletonLine key={line} />
          ))}
        </Main>
      </Hero>
    </Content>
  );
}

/**
 * The series page's organism: `page.SeriesPage`'s hero over one read of
 * `GET /api/series/:id` — the art, the title, a meta line of the **Year
 * range**, the counts and read-only stars, the genre chips, the one Resume /
 * Play button, the progress line, the synopsis and the credits. Everything it
 * draws was decided by `seriesView`.
 *
 * Under the hero, the Seasons grid: one Season card per season, each opening
 * its season page. Beside the button, the series' heart — shown at once, put
 * back if the save is refused. The button is inert: episode playback does not
 * exist yet, so it goes nowhere and writes nothing.
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

  return (
    <>
      <ArtArea aria-hidden="true">
        <Artwork url={series.backdropUrl} g1={series.g1} g2={series.g2} />
        <Scrim />
      </ArtArea>

      <Content>
        <Hero>
          <PosterColumn>
            <PosterFrame>
              <Artwork url={series.posterUrl} g1={series.g1} g2={series.g2} />
              {series.hasArtwork ? null : (
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

            <Meta>
              {metaSegments(series).map((segment, index) => (
                <Fragment key={segment.key}>
                  {index > 0 ? <Separator>{META_SEPARATOR}</Separator> : null}
                  {segment.node}
                </Fragment>
              ))}
            </Meta>

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
              />
              <CircleToggle
                label={series.isFavorite ? FAVORITE_TIP.on : FAVORITE_TIP.off}
                title={series.isFavorite ? FAVORITE_TIP.on : FAVORITE_TIP.off}
                size={CIRCLE_SIZE}
                pressed={series.isFavorite}
                $on={series.isFavorite}
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
