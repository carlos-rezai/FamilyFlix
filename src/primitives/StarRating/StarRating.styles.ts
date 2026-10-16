import styled from 'styled-components';

export const Root = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

export const StarWrap = styled.span<{ $size: number }>`
  position: relative;
  display: inline-block;
  font-size: ${({ $size }) => $size}px;
  line-height: 1;
  letter-spacing: ${({ $size }) => Math.round($size * 0.14)}px;
  white-space: nowrap;
`;

export const StarBase = styled.span`
  color: rgba(255, 255, 255, 0.22);
`;

export const StarFill = styled.span<{ $rating: number }>`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${({ $rating }) => $rating}%;
  overflow: hidden;
  color: ${({ theme }) => theme.colors.accent};
  white-space: nowrap;
`;

export const Value = styled.span<{ $size: number }>`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: ${({ $size }) => Math.round($size * 0.86)}px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The small uppercase word after the value — whose rating it is. */
export const Tag = styled.span<{ $size: number }>`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: ${({ $size }) => Math.round($size * 0.7)}px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;
