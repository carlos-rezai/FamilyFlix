import styled from 'styled-components';

/**
 * The page's own scroll container, rather than the document's. The art area
 * inside is sized as a percentage of this box, so it resolves against the
 * viewport — under document scroll it would resolve against *content* height,
 * and a movie with a ten-line synopsis would get a taller backdrop than one
 * with two lines. It is the positioned ancestor that area is placed against.
 */
export const Scroller = styled.div`
  position: relative;
  height: 100vh;
  overflow-y: auto;
  background: ${({ theme }) => theme.colors.bg};
`;

/**
 * Translucent over artwork, which is why this screen drops `MainLayout`'s solid
 * header: it is chrome that only reads over a picture.
 */
export const BackPill = styled.button`
  position: fixed;
  top: 24px;
  left: 24px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 18px 0 14px;
  background: rgba(20, 17, 13, 0.6);
  backdrop-filter: blur(10px);
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
