import styled from 'styled-components';

import {
  cardFocus,
  cardLift,
} from '@/styles/interactionStates/interactionStates';

/**
 * The whole card is one button: transparent, unpadded, left-aligned, carrying
 * the Card's keyboard outline on the tile's radius.
 */
export const Root = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radius.md};

  ${cardFocus}
`;

/** The 2:3 tile — the lift is its own, so the lines below do not raise it. */
export const Tile = styled.span`
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};

  ${cardLift}
`;

export const Numeral = styled.span`
  position: absolute;
  left: 14px;
  bottom: 12px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 30px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
`;

export const BadgeWrap = styled.span`
  position: absolute;
  top: 10px;
  right: 10px;
`;

export const ProgressWrap = styled.span`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`;

export const Label = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-top: 10px;
`;

export const SubLabel = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-top: 2px;
`;
