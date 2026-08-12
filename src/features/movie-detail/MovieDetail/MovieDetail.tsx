import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ExpandableText } from '@/components';
import { Button, Chip, MoreIcon, StarRating } from '@/primitives';
import type { MovieDetailModel } from '@/types';
import { useMovieDetail } from '../useMovieDetail/useMovieDetail';
import {
  ArtArea,
  Art,
  Scrim,
  Content,
  PosterColumn,
  PosterFrame,
  TopTag,
  PosterTitle,
  Main,
  Title,
  MetaLine,
  MetaText,
  Separator,
  RatingWrap,
  WatchedBadge,
  Genres,
  ActionRow,
  MenuSlot,
  MoreButton,
  Menu,
  MenuItem,
  MenuGlyph,
  SynopsisWrap,
  Credits,
  Credit,
  CastCredit,
  CreditLabel,
  CreditValue,
  CastValue,
  Message,
  MessageTitle,
  MessageBody,
  MessageAction,
  BackLink,
  SkeletonPoster,
  SkeletonTitle,
  SkeletonMeta,
  SkeletonChips,
  SkeletonChip,
  SkeletonLine,
} from './MovieDetail.styles';

/** The synopsis measure, from `page.MoviePage.dc.html`. */
const SYNOPSIS_LINES = 4;
const SYNOPSIS_FONT_SIZE = 17;
const SYNOPSIS_MAX_WIDTH = 560;

/** The stars sit at 20px on this page — larger than a card's 13px. */
const STAR_SIZE = 20;

/** Drawn between two surviving meta segments, never beside a missing one. */
const META_SEPARATOR = '•';

const range = (length: number) => Array.from({ length }, (_, index) => index);

/** One item on the meta line, keyed so the interleaved separators stay stable. */
interface MetaSegment {
  key: string;
  node: ReactNode;
}

/**
 * The meta line's surviving segments, in order. Composing the list first is what
 * makes a dangling separator unrepresentable: the separators below are generated
 * *between* the members of this list, so an absent segment cannot leave one
 * behind. Every decision about what is absent was already made in `detailView`.
 */
function metaSegments(movie: MovieDetailModel): MetaSegment[] {
  const segments: MetaSegment[] = [];

  if (movie.year !== null) {
    segments.push({ key: 'year', node: <MetaText>{movie.year}</MetaText> });
  }
  if (movie.runtimeLabel !== null) {
    segments.push({
      key: 'runtime',
      node: <MetaText>{movie.runtimeLabel}</MetaText>,
    });
  }
  if (movie.ratingPercent !== null) {
    segments.push({
      key: 'rating',
      node: (
        <RatingWrap>
          <StarRating rating={movie.ratingPercent} size={STAR_SIZE} showValue />
        </RatingWrap>
      ),
    });
  }

  return segments;
}

/**
 * The ⋯ overflow menu, in its fixed slot opposite the Back pill.
 *
 * It ships with one item. Delete is not designed anywhere in the handoff — no
 * confirmation exists — so it lands with its own feature rather than as a red
 * row that closes the menu and does nothing, or a permanently greyed one that
 * reads as "this movie can't be deleted".
 *
 * Closing is deliberately symmetrical: Escape, a press outside, and activating
 * the item all shut it, and each one hands focus back to the trigger, so a
 * keyboard user is never dropped at the top of the document.
 *
 * Edit navigates to `/add?movie=<id>`, the prototype's own route for editing (it
 * pre-fills the add form rather than owning an `/edit` screen). The query
 * parameter is **provisional** — the movie-form grill owns the real contract.
 */
function EditMenu({ movieId }: { movieId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    // Pointerdown rather than click: the menu should be gone by the time the
    // press it was dismissed by lands on whatever is underneath.
    const onPointerDown = (event: PointerEvent) => {
      if (!slotRef.current?.contains(event.target as Node)) {
        close();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  const editDetails = () => {
    close();
    navigate(`/add?movie=${movieId}`);
  };

  return (
    <MenuSlot ref={slotRef}>
      <MoreButton
        ref={triggerRef}
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <MoreIcon size={20} />
      </MoreButton>
      {open ? (
        <Menu>
          <MenuItem type="button" onClick={editDetails}>
            <MenuGlyph aria-hidden="true">✎</MenuGlyph>
            Edit details
          </MenuItem>
        </Menu>
      ) : null}
    </MenuSlot>
  );
}

/** The page's own shape, held while the movie loads, rather than a blank screen. */
function LoadingDetail() {
  return (
    <Content role="status" aria-label="Loading movie">
      <PosterColumn aria-hidden="true">
        <SkeletonPoster />
      </PosterColumn>
      <Main aria-hidden="true">
        <SkeletonTitle />
        <SkeletonMeta />
        <SkeletonChips>
          {range(2).map((chip) => (
            <SkeletonChip key={chip} />
          ))}
        </SkeletonChips>
        {range(3).map((line) => (
          <SkeletonLine key={line} />
        ))}
      </Main>
    </Content>
  );
}

/**
 * A movie that is gone gets a way back to the library and no Retry — reloading
 * a 404 is a button that can never work.
 */
function MovieMissing() {
  return (
    <Message>
      <MessageTitle>That movie isn’t here</MessageTitle>
      <MessageBody>It may have been removed from your library.</MessageBody>
      <MessageAction>
        <BackLink to="/">Back to library</BackLink>
      </MessageAction>
    </Message>
  );
}

/** A movie that failed to load gets the opposite affordance: Retry, no link. */
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <Message>
      <MessageTitle>Couldn’t load this movie</MessageTitle>
      <MessageBody>Something went wrong reading it.</MessageBody>
      <MessageAction>
        <Button label="Retry" variant="secondary" onClick={onRetry} />
      </MessageAction>
    </Message>
  );
}

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
 * The action row ships with its navigating half only: Play opens the player's
 * URL and the ⋯ menu opens the add screen, neither of them writing anything.
 * The two circular toggles beside Play become real in the next slice.
 */
export function MovieDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = useMovieDetail(id ?? '');

  if (detail.status === 'loading') {
    return <LoadingDetail />;
  }
  if (detail.status === 'not-found') {
    return <MovieMissing />;
  }
  if (detail.status === 'error') {
    return <LoadFailed onRetry={detail.retry} />;
  }

  const { movie } = detail;

  return (
    <>
      <ArtArea aria-hidden="true">
        <Art $url={movie.backdropUrl} $g1={movie.g1} $g2={movie.g2} />
        <Scrim />
      </ArtArea>

      <EditMenu movieId={movie.id} />

      <Content>
        <PosterColumn>
          <PosterFrame>
            <Art $url={movie.posterUrl} $g1={movie.g1} $g2={movie.g2} />
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

          <MetaLine>
            {metaSegments(movie).map((segment, index) => (
              <Fragment key={segment.key}>
                {index > 0 ? <Separator>{META_SEPARATOR}</Separator> : null}
                {segment.node}
              </Fragment>
            ))}
            {movie.isWatched ? <WatchedBadge>✓ Watched</WatchedBadge> : null}
          </MetaLine>

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

          {movie.hasCredits ? (
            <Credits>
              <Credit>
                <CreditLabel>Director</CreditLabel>
                <CreditValue>{movie.director}</CreditValue>
              </Credit>
              <CastCredit>
                <CreditLabel>Cast</CreditLabel>
                <CastValue>{movie.castText}</CastValue>
              </CastCredit>
            </Credits>
          ) : null}
        </Main>
      </Content>
    </>
  );
}
