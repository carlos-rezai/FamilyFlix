import styled from 'styled-components';

import { IconButton } from '@/primitives';

export const Root = styled.div`
  width: 100%;
  cursor: pointer;
`;

export const Poster = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
  }
`;

export const Art = styled.div<{
  $posterUrl: string | null;
  $g1: string;
  $g2: string;
}>`
  position: absolute;
  inset: 0;
  background: ${({ $posterUrl, $g1, $g2 }) =>
    $posterUrl
      ? `center / cover no-repeat url(${$posterUrl})`
      : `linear-gradient(155deg, ${$g1} 0%, ${$g2} 100%)`};
`;

export const InnerBorder = styled.div`
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: ${({ theme }) => theme.radius.md};
  pointer-events: none;
`;

/**
 * The heart pinned to the poster's top-left corner. `IconButton` supplies the
 * square, the pill corner and the toggle semantics; everything here is the
 * chrome that lets it read over artwork — a translucent fill, a blur, and a
 * hairline that survives against a bright poster.
 *
 * The hover repeats the ink deliberately: the heart brightens its fill on hover
 * and keeps its colour, so the primitive's ghost face — which shifts both —
 * has to be answered on both counts.
 */
export const FavButton = styled(IconButton)<{ $favorite: boolean }>`
  position: absolute;
  top: 10px;
  left: 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(18, 14, 10, 0.5);
  backdrop-filter: blur(4px);
  z-index: 3;
  color: ${({ theme, $favorite }) =>
    $favorite ? theme.colors.accent : '#fff'};

  &:hover:enabled {
    background: rgba(18, 14, 10, 0.82);
    color: ${({ theme, $favorite }) =>
      $favorite ? theme.colors.accent : '#fff'};
  }
`;

export const TitleOverlay = styled.div`
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 18px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 21px;
  line-height: 1.12;
  color: #fff;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.55);
`;

export const BadgeWrap = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
`;

export const ProgressWrap = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`;

export const MetaWrap = styled.div`
  margin-top: 10px;
`;

export const TitleBelow = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const StarRow = styled.div`
  margin-top: 5px;
`;
