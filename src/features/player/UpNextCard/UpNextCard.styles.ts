import styled from 'styled-components';

import { controlStates } from '@/styles/interactionStates/interactionStates';

/**
 * The **Up next card**, the `showNextEp` block of `feat.PlayerControls.dc.html`:
 * 372px of dark glass, 28px from the right and 150px up, over the chrome.
 */
export const Card = styled.div`
  position: absolute;
  right: 28px;
  bottom: 150px;
  z-index: 40;
  width: 372px;
  display: flex;
  gap: 14px;
  padding: 14px;
  background: rgba(20, 17, 13, 0.88);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  animation: ffPop ${({ theme }) => theme.motion.durBase} ease;
`;

/** The next episode's 16:9 thumbnail, drawn from its id's own gradient. */
export const Thumb = styled.div<{ $g1: string; $g2: string }>`
  flex: 0 0 auto;
  width: 104px;
  aspect-ratio: 16 / 9;
  border-radius: 7px;
  background: linear-gradient(
    150deg,
    ${({ $g1 }) => $g1} 0%,
    ${({ $g2 }) => $g2} 100%
  );
`;

export const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

export const Label = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
`;

export const Code = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-top: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Actions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 10px;
`;

export const PlayNow = styled.button`
  height: 36px;
  padding: 0 16px;
  background: ${({ theme }) => theme.colors.accent};
  border: none;
  border-radius: 8px;
  color: #1a1109;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  ${controlStates('scale(.98)')}

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.accentHover};
  }
`;

export const Cancel = styled.button`
  height: 36px;
  padding: 0 14px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  ${controlStates('scale(.98)')}

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }
`;
