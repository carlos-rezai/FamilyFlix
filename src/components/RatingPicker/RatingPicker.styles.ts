import styled from 'styled-components';

export const Root = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 14px;
`;

/** The strip of stars. Its gap scales off the star size — 5px at the 30px default. */
export const Stars = styled.span<{ $size: number }>`
  display: inline-flex;
  gap: ${({ $size }) => Math.round($size / 6)}px;
`;

/**
 * One star, as the control it is. The glyph is the button's own text, dimmed,
 * with the accent-coloured fill clipped over it — the prototype's box, with a
 * `<button>` where its bare `<div onClick>` was.
 */
export const StarButton = styled.button<{ $size: number }>`
  position: relative;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  padding: 0;
  border: none;
  background: none;
  font-size: ${({ $size }) => $size}px;
  line-height: ${({ $size }) => $size}px;
  color: rgba(255, 255, 255, 0.2);
  cursor: pointer;
`;

/** How full one star is drawn: the clipped overlay, laid over the dim glyph. */
export const StarFill = styled.span<{ $fill: number }>`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${({ $fill }) => $fill}%;
  overflow: hidden;
  color: ${({ theme }) => theme.colors.accent};
  pointer-events: none;
`;

export const Value = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
  white-space: nowrap;
`;
