import styled, { css } from 'styled-components';

/** The poster column width — `--card-w` in `docs/handoff/tokens.css`. */
export const CARD_WIDTH = 210;

export const Root = styled.div`
  position: relative;
`;

export const Scroller = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s5};
  overflow-x: auto;
  padding: ${({ theme }) => `4px ${theme.space.s6} ${theme.space.s5}`};
  scroll-padding-left: ${({ theme }) => theme.space.s6};
  scroll-behavior: smooth;
`;

export const Item = styled.div<{ $width: number }>`
  flex: 0 0 auto;
  width: ${({ $width }) => `${$width}px`};
`;

const arrow = css<{ $top: number }>`
  position: absolute;
  top: ${({ $top }) => `${$top}px`};
  transform: translateY(-50%);
  z-index: 6;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(20, 17, 13, 0.9);
  backdrop-filter: blur(6px);
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);

  &:hover {
    background: ${({ theme }) => theme.colors.surface3};
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.accent};
  }
`;

export const LeftArrow = styled.button<{ $top: number }>`
  ${arrow}
  left: 10px;
`;

export const RightArrow = styled.button<{ $top: number }>`
  ${arrow}
  right: 10px;
`;
