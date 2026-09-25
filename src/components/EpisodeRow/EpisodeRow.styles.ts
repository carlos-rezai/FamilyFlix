import styled from 'styled-components';

import {
  cardFocus,
  cardLift,
  controlStates,
} from '@/styles/interactionStates/interactionStates';

/**
 * The row — a **Card**: it lifts on `cardLift` and outlines on `cardFocus`,
 * never recolouring its fill (the prototype's own −2px and surface change are
 * the vocabulary the contract replaced).
 */
export const Root = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;

  ${cardLift}
  ${cardFocus}
`;

/** The 168px 16:9 thumbnail in the series' gradient. */
export const Thumb = styled.div<{ $g1: string; $g2: string }>`
  position: relative;
  flex: 0 0 auto;
  width: 168px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: ${({ $g1, $g2 }) =>
    `linear-gradient(150deg, ${$g1} 0%, ${$g2} 100%)`};
`;

/** The play glyph, shown while the row is hovered. */
export const PlayHover = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  opacity: 0;
  color: #fff;
  transition: opacity ${({ theme }) => theme.motion.durFast}
    ${({ theme }) => theme.motion.easeOut};

  ${Root}:hover & {
    opacity: 1;
  }
`;

export const PlayDisc = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 99px;
  background: rgba(20, 17, 13, 0.6);
  display: grid;
  place-items: center;
`;

export const ProgressWrap = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
`;

export const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Heading = styled.div`
  display: flex;
  align-items: baseline;
  gap: 9px;
`;

export const Code = styled.span`
  flex: 0 0 auto;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export const Title = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Line = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  margin-top: 4px;
`;

export const ResumeLine = styled(Line)`
  color: ${({ theme }) => theme.colors.accent};
`;

/** The watched box — a **Control**, pressing to `scale(.92)`. */
export const WatchedBox = styled.button<{ $watched: boolean }>`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
  border: 2px solid
    ${({ $watched, theme }) =>
      $watched ? theme.colors.accent : theme.colors.textFaint};
  background: ${({ $watched, theme }) =>
    $watched ? theme.colors.accent : 'transparent'};
  color: #1a1109;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;

  ${controlStates('scale(.92)')}

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: scale(1.08);
  }
`;
