import styled from 'styled-components';

import { IconButton } from '@/primitives';
import {
  cardFocus,
  cardLift,
} from '@/styles/interactionStates/interactionStates';

/**
 * The focusable root carries the Card's keyboard outline, rounded to the
 * poster's radius; the lift is the tile's alone, so a pointer on the title
 * below does not raise the art.
 */
export const Root = styled.div`
  width: 100%;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radius.md};

  ${cardFocus}
`;

export const Poster = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};

  ${cardLift}
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
 * The hover repeats the ink deliberately: the heart darkens its backing,
 * brightens its hairline and grows on hover while keeping its colour, so the
 * primitive's ghost face has to be answered on every count. Because that hover
 * writes `transform`, the heart writes its own press as well; the 60ms and the
 * keyboard ring stay the Control's.
 */
export const FavoriteButton = styled(IconButton)<{ $favorite: boolean }>`
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
    border-color: rgba(255, 255, 255, 0.45);
    color: ${({ theme, $favorite }) =>
      $favorite ? theme.colors.accent : '#fff'};
    transform: scale(1.08);
  }

  &:active:enabled {
    transform: scale(0.92);
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
