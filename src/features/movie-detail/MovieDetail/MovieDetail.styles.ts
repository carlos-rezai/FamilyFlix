import styled from 'styled-components';

import { LoadMessage } from '@/components';
import { IconButton, Skeleton } from '@/primitives';

/**
 * The full-bleed art area behind the top of the page. It is sized against the
 * scroll container (`MoviePage`), not the content, so a movie with a ten-line
 * synopsis and one with two lines get identically-sized backdrops.
 */
export const ArtArea = styled.div`
  position: absolute;
  inset: 0;
  height: 62%;
  overflow: hidden;
`;

/** Three stops, landing on the page background so the art has no bottom edge. */
export const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(20, 17, 13, 0.45) 0%,
    rgba(20, 17, 13, 0.82) 55%,
    ${({ theme }) => theme.colors.bg} 100%
  );
`;

export const Content = styled.div`
  position: relative;
  z-index: 10;
  max-width: 1000px;
  margin: 0 auto;
  padding: ${({ theme }) => `130px ${theme.space.s6} ${theme.space.s8}`};
  display: flex;
  gap: ${({ theme }) => theme.space.s7};
  align-items: flex-start;
`;

export const PosterColumn = styled.div`
  flex: 0 0 300px;
`;

export const PosterFrame = styled.div`
  position: relative;
  width: 300px;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

export const TopTag = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  top: 18px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
`;

export const PosterTitle = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 22px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 27px;
  line-height: 1.1;
  color: #fff;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.6);
`;

export const Main = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  padding-top: 6px;
`;

export const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 700;
  font-size: 48px;
  line-height: 1.04;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

export const Genres = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
`;

/**
 * The primary actions, directly under the genre chips and above the fold: Play
 * and the two circular toggles beside it.
 */
export const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 28px;
  flex-wrap: wrap;
`;

/**
 * One of the two circles beside Play — the watched tick and the favorite heart.
 * `$on` is the whole of its appearance: filled in the accent when the flag is
 * set, a bare outline when it is not, so the state is legible without reading
 * the icon inside it. The square itself, and the `aria-pressed` that carries
 * `$on` to a screen reader, come from `IconButton`.
 */
export const CircleToggle = styled(IconButton)<{ $on: boolean }>`
  background: ${({ theme, $on }) =>
    $on ? theme.colors.accentSoft : 'transparent'};
  border: 1px solid
    ${({ theme, $on }) => ($on ? theme.colors.accentLine : theme.colors.border)};
  color: ${({ theme, $on }) =>
    $on ? theme.colors.accent : theme.colors.textDim};

  /* Hovering brightens the outline, never the fill — a circle that is off must
     not preview the filled state it would take on. */
  &:hover:enabled {
    background: ${({ theme, $on }) =>
      $on ? theme.colors.accentSoft : 'transparent'};
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export const SynopsisWrap = styled.div`
  margin-top: 32px;
`;

/**
 * The block the two failure screens share. The stacking context is all this
 * page adds to it: the art area is absolutely positioned across the top of the
 * same scroller, and a message without a z-index paints underneath it.
 */
export const DetailMessage = styled(LoadMessage)`
  position: relative;
  z-index: 10;
`;

export const SkeletonPoster = styled(Skeleton)`
  width: 300px;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.lg};
`;

export const SkeletonTitle = styled(Skeleton)`
  width: 60%;
  height: 44px;
`;

export const SkeletonMeta = styled(Skeleton)`
  width: 240px;
  height: 20px;
  margin-top: 20px;
`;

export const SkeletonChips = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
`;

export const SkeletonChip = styled(Skeleton)`
  width: 90px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;

export const SkeletonLine = styled(Skeleton)`
  width: 100%;
  max-width: 560px;
  height: 16px;
  margin-top: 14px;
`;
