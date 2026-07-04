import styled from 'styled-components';

export const Root = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colors.watched};
  /* The check inherits this as currentColor — a dark stamp on the olive badge. */
  color: ${({ theme }) => theme.colors.bg};
  display: grid;
  place-items: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
`;
