import styled from 'styled-components';

import { LoadMessage } from '@/components';
import { IconButton, Skeleton } from '@/primitives';

/** The art area behind the top of the page — 520px, `page.SeriesPage`'s. */
export const ArtArea = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 520px;
  overflow: hidden;
`;

/** Three stops, landing on the page background so the art has no bottom edge. */
export const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(20, 17, 13, 0.35) 0%,
    rgba(20, 17, 13, 0.8) 55%,
    ${({ theme }) => theme.colors.bg} 100%
  );
`;

export const Content = styled.div`
  position: relative;
  z-index: 10;
  max-width: 1100px;
  margin: 0 auto;
  padding: ${({ theme }) => `130px ${theme.space.s6} ${theme.space.s8}`};
`;

export const Hero = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s7};
  align-items: flex-start;
`;

export const PosterColumn = styled.div`
  flex: 0 0 260px;
`;

export const PosterFrame = styled.div`
  position: relative;
  width: 260px;
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
  font-size: 25px;
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
  font-size: 46px;
  line-height: 1.04;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

export const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  flex-wrap: wrap;
`;

/** One textual **Meta segment** — the year range, or the counts. */
export const MetaText = styled.span`
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 17px;
  color: ${({ theme }) => theme.colors.textDim};
`;

export const Separator = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
`;

export const Genres = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
  flex-wrap: wrap;
`;

export const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 28px;
  flex-wrap: wrap;
`;

/**
 * The series' heart beside the button — the movie page's circle: filled in
 * the accent when the series is a favorite, a bare outline when not. Hovering
 * brightens the outline, never the fill, and draws no scale; the press, the
 * square and `aria-pressed` are `IconButton`'s.
 */
export const CircleToggle = styled(IconButton)<{ $on: boolean }>`
  background: ${({ theme, $on }) =>
    $on ? theme.colors.accentSoft : 'transparent'};
  border: 1px solid
    ${({ theme, $on }) => ($on ? theme.colors.accentLine : theme.colors.border)};
  color: ${({ theme, $on }) =>
    $on ? theme.colors.accent : theme.colors.textDim};

  &:hover:not(:disabled) {
    background: ${({ theme, $on }) =>
      $on ? theme.colors.accentSoft : 'transparent'};
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.accent};
    transform: none;
  }
`;

export const Progress = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export const SynopsisWrap = styled.div`
  margin-top: 26px;
  max-width: 640px;
`;

/** The failure screens, lifted over the absolutely-placed art area. */
export const DetailMessage = styled(LoadMessage)`
  position: relative;
  z-index: 10;
`;

export const SkeletonPoster = styled(Skeleton)`
  width: 260px;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.lg};
`;

export const SkeletonTitle = styled(Skeleton)`
  width: 60%;
  height: 44px;
`;

export const SkeletonLine = styled(Skeleton)`
  width: 100%;
  max-width: 560px;
  height: 16px;
  margin-top: 14px;
`;

/** The Seasons grid under the hero, `page.SeriesPage`'s. */
export const SeasonsSection = styled.section`
  position: relative;
  margin-top: ${({ theme }) => theme.space.s8};
`;

export const SeasonsHeading = styled.h2`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.text};
  margin: 0 0 ${({ theme }) => theme.space.s4};
`;

export const SeasonsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: ${({ theme }) => theme.space.s5};
`;
