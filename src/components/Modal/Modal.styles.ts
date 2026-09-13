import styled, { keyframes } from 'styled-components';

const fade = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
`;

const pop = keyframes`
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: none; }
`;

/**
 * The scrim: the whole viewport, dimmed and blurred, with the card centred in
 * it. `fixed` where the prototype's frame uses `absolute; inset: 0` — the card
 * is portalled to the document body precisely so it does not sit inside a
 * scroll container, and `fixed` is what covers the viewport from there.
 */
export const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: ${({ theme }) => theme.colors.scrim};
  backdrop-filter: blur(4px);
  animation: ${fade} 0.18s ease;
  padding: 24px;
`;

/**
 * The card itself — the prototype's 520px sheet on `surface-2`. It takes
 * focus as it opens (`tabIndex=-1`) and draws no ring for it: the prototype
 * shows none, and the card is where focus starts, not a control.
 */
export const Card = styled.div`
  outline: none;
  width: 520px;
  max-width: 100%;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  animation: ${pop} 0.2s ease;
`;

export const Header = styled.div`
  padding: 28px 28px 0;
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 14px;
`;

/**
 * The 44px accent-soft square the icon sits in. Omitted when there is none.
 * One element where the prototype nests a 22px span inside the tile: the span
 * only centred the glyph, which the tile's own grid already does, and the
 * glyph's size, line-height and ink are the same either way.
 */
export const IconTile = styled.div`
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.accentSoft};
  border: 1px solid ${({ theme }) => theme.colors.accentLine};
  display: grid;
  place-items: center;
  font-size: 22px;
  line-height: 1;
  color: ${({ theme }) => theme.colors.accent};
`;

export const Heading = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
  overflow-wrap: anywhere;
`;

export const Subtitle = styled.p`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textFaint};
  margin: 4px 0 0;
`;

/**
 * The ✕. A local button rather than `IconButton`: the prototype draws a
 * 34px rounded square holding a text glyph, which is neither of that
 * primitive's two round variants.
 */
export const CloseButton = styled.button`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: none;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textFaint};
  cursor: pointer;
  font-size: 16px;

  &:hover {
    background: ${({ theme }) => theme.colors.surface3};
    color: ${({ theme }) => theme.colors.textDim};
  }
`;

export const Body = styled.div`
  padding: 22px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;
