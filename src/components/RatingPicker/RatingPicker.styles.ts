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
 * One star. The glyph is the box's own text, dimmed, with the accent-coloured
 * fill clipped over it and the two **Half-star segments** laid on top — the
 * prototype's box exactly, with its bare `<div onClick>` hit areas promoted to
 * real elements.
 */
export const Star = styled.span<{ $size: number }>`
  position: relative;
  flex: 0 0 auto;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
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

/**
 * One **Half-star segment** — half a star's width of clickable area, sitting
 * over the glyph. It carries no glyph of its own, so the star underneath is
 * drawn once whichever half a parent is aiming at.
 */
export const Segment = styled.button<{ $half: 'left' | 'right' }>`
  position: absolute;
  ${({ $half }) => ($half === 'left' ? 'left: 0;' : 'right: 0;')}
  top: 0;
  width: 50%;
  height: 100%;
  z-index: 2;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
`;

export const Value = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
  white-space: nowrap;
`;
