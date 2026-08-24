import styled from 'styled-components';

export const Root = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: radial-gradient(
    140% 90% at 80% -10%,
    #1d1812 0%,
    ${({ theme }) => theme.colors.bg} 60%
  );
`;

export const Header = styled.header`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: ${({ theme }) => `${theme.space.s4} ${theme.space.s6}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderSoft};
  background: rgba(20, 17, 13, 0.85);
  backdrop-filter: blur(12px);
  position: relative;
  z-index: 40;
`;

/**
 * Solid rather than `MoviePage`'s translucent pill: this chrome sits on a header
 * strip, not over artwork.
 */
export const BackPill = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px 0 14px;
  flex: 0 0 auto;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.surface2};
  }
`;

/**
 * Where the heading sits in the strip, not what it looks like. It gives up width
 * before the pill or the trailing controls do, and `min-width: 0` is what lets a
 * long genre name inside it truncate rather than push them off the edge.
 */
export const HeadingSlot = styled.div`
  flex: 0 1 auto;
  min-width: 0;
`;

/** Pushes the trailing header controls to the right edge. */
export const Spacer = styled.div`
  flex: 1 1 auto;
`;

export const Body = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
`;
