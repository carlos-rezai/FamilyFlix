import styled from 'styled-components';

/** The loader centred in the card, faded in as the idle face goes. */
export const Body = styled.div`
  min-height: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  animation: ffFade 0.18s ease;
`;
