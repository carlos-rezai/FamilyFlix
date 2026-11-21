import styled from 'styled-components';

/**
 * The layer over a `Modal`'s hidden idle face: the card's own size
 * (`inset: 0`), the loader centred on `surface2`, faded in as the face goes.
 */
export const Layer = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  background: ${({ theme }) => theme.colors.surface2};
  animation: ffFade 0.18s ease;
`;
