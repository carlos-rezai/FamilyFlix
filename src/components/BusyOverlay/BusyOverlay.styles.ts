import styled from 'styled-components';

/**
 * The scrim over the whole row: `bg` at .55 under a light blur, the row's own
 * corners, the loader centred on it, fading in.
 */
export const Scrim = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  border-radius: inherit;
  cursor: progress;
  background: rgba(20, 17, 13, 0.55);
  backdrop-filter: blur(4px);
  animation: ffFade 0.18s ease;
`;
