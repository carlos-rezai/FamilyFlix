import { useNavigate, useParams } from 'react-router-dom';

import { ExpandableText } from '@/components';
import {
  Artwork,
  Button,
  CheckIcon,
  Chip,
  HeartIcon,
  HeartOutlineIcon,
} from '@/primitives';
import { CreditsRow } from '../CreditsRow/CreditsRow';
import { EditMenu } from '../EditMenu/EditMenu';
import { LoadingDetail } from '../LoadingDetail/LoadingDetail';
import { MetaLine } from '../MetaLine/MetaLine';
import { useMovieDetail } from '../useMovieDetail/useMovieDetail';
import {
  ArtArea,
  Scrim,
  Content,
  PosterColumn,
  PosterFrame,
  TopTag,
  PosterTitle,
  Main,
  Title,
  Genres,
  ActionRow,
  CircleToggle,
  SynopsisWrap,
  DetailMessage,
} from './MovieDetail.styles';

/** The synopsis measure, from `page.MoviePage.dc.html`. */
const SYNOPSIS_LINES = 4;
const SYNOPSIS_FONT_SIZE = 17;
const SYNOPSIS_MAX_WIDTH = 560;

/** The two circles' icons, at the sizes the prototype draws them. */
const CHECK_SIZE = 24;
const HEART_SIZE = 23;

/** The two circles' square, matching the `lg` Play button they sit beside. */
const CIRCLE_SIZE = 58;

/**
 * The toggles' tips, straight from the prototype. The label *is* the state and
 * names the next click, so a parent using a screen reader is told which way the
 * circle goes rather than only that a button is there.
 */
const WATCHED_TIP = {
  on: 'Watched — click to unmark',
  off: 'Mark as watched',
} as const;

const FAVORITE_TIP = {
  on: 'In Favorites — click to remove',
  off: 'Add to Favorites',
} as const;

/**
 * The movie detail screen — one movie in full, loaded by the id in the URL: the
 * backdrop under its scrim, the poster, the title, the meta line, the genre
 * chips, the clamped synopsis, and the credits.
 *
 * It renders what `detailView` gives it and asks no display questions of its
 * own: the only conditionals here are "does this segment exist", each one
 * reading a `null` the mapper decided. The exception is the meta line's
 * separators, which are interleaved between the surviving segments because the
 * stars sit in the middle of the line and no single string could hold them.
 *
 * The action row's navigating half writes nothing: Play opens the player's URL
 * and the ⋯ menu opens the add screen, because only the player owns playback
 * state. Its writing half is the two circles beside Play, each of which shows
 * its new value at once and hands the save to the hook — as does the meta
 * line's rating picker, the page's third write and the only one off the row.
 */
export function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useMovieDetail(id ?? '');

  if (detail.status === 'loading') {
    return <LoadingDetail />;
  }
  // A movie that is gone gets a way back to the library and no Retry —
  // reloading a 404 is a button that can never work.
  if (detail.status === 'not-found') {
    return (
      <DetailMessage
        title="That movie isn’t here"
        body="It may have been removed from your library."
        action={<Button label="Back to library" to="/" variant="secondary" />}
      />
    );
  }
  // A movie that failed to load gets the opposite affordance: Retry, no link.
  if (detail.status === 'error') {
    return (
      <DetailMessage
        title="Couldn’t load this movie"
        body="Something went wrong reading it."
        action={
          <Button label="Retry" variant="secondary" onClick={detail.retry} />
        }
      />
    );
  }

  const { movie } = detail;

  return (
    <>
      <ArtArea aria-hidden="true">
        <Artwork url={movie.backdropUrl} g1={movie.g1} g2={movie.g2} />
        <Scrim />
      </ArtArea>

      <EditMenu movieId={movie.id} />

      <Content>
        <PosterColumn>
          <PosterFrame>
            <Artwork url={movie.posterUrl} g1={movie.g1} g2={movie.g2} />
            {/* Overlays caption the gradient placeholder only — real artwork is
                never covered by text that duplicates the heading beside it. */}
            {movie.hasArtwork ? null : (
              <>
                {movie.topTag === null ? null : <TopTag>{movie.topTag}</TopTag>}
                <PosterTitle>{movie.title}</PosterTitle>
              </>
            )}
          </PosterFrame>
        </PosterColumn>

        <Main>
          <Title>{movie.title}</Title>

          <MetaLine
            year={movie.year}
            runtimeLabel={movie.runtimeLabel}
            ratingPercent={movie.ratingPercent}
            isWatched={movie.isWatched}
            onRate={detail.rate}
          />

          <Genres>
            {movie.genres.map((genre) => (
              <Chip key={genre} label={genre} size="sm" />
            ))}
          </Genres>

          <ActionRow>
            {/* Opening the player's URL is the whole of it: playback state is
                written by the player and by nothing else. */}
            <Button
              label={movie.playLabel}
              variant="primary"
              size="lg"
              icon="play"
              onClick={() => navigate(`/movie/${movie.id}/play`)}
            />

            {/* Both circles fill on the click rather than on the save: a toggle
                that waits for a round trip reads as a click that didn't land.
                The hook puts them back if the save is refused. */}
            <CircleToggle
              label={movie.isWatched ? WATCHED_TIP.on : WATCHED_TIP.off}
              title={movie.isWatched ? WATCHED_TIP.on : WATCHED_TIP.off}
              size={CIRCLE_SIZE}
              pressed={movie.isWatched}
              $on={movie.isWatched}
              onClick={detail.toggleWatched}
            >
              <CheckIcon size={CHECK_SIZE} />
            </CircleToggle>

            <CircleToggle
              label={movie.isFavorite ? FAVORITE_TIP.on : FAVORITE_TIP.off}
              title={movie.isFavorite ? FAVORITE_TIP.on : FAVORITE_TIP.off}
              size={CIRCLE_SIZE}
              pressed={movie.isFavorite}
              $on={movie.isFavorite}
              onClick={detail.toggleFavorite}
            >
              {movie.isFavorite ? (
                <HeartIcon size={HEART_SIZE} />
              ) : (
                <HeartOutlineIcon size={HEART_SIZE} />
              )}
            </CircleToggle>
          </ActionRow>

          {movie.synopsis === null ? null : (
            <SynopsisWrap>
              <ExpandableText
                text={movie.synopsis}
                lines={SYNOPSIS_LINES}
                fontSize={SYNOPSIS_FONT_SIZE}
                maxWidth={SYNOPSIS_MAX_WIDTH}
              />
            </SynopsisWrap>
          )}

          <CreditsRow
            director={movie.director}
            castText={movie.castText}
            hasCredits={movie.hasCredits}
          />
        </Main>
      </Content>
    </>
  );
}
