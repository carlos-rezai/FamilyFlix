import styled from 'styled-components';

/**
 * The bar's width, from `mol.SearchBar.dc.html`: it takes the room the header
 * gives it and stops at its cap — 460px in the prototype's own header.
 *
 * The prototype's `grow` prop (the fixed-width branch) is not here; it lands
 * with GenrePage, its second caller.
 */
export const Root = styled.div<{ $maxWidth: number }>`
  flex: 1 1 auto;
  max-width: ${({ $maxWidth }) => `${$maxWidth}px`};
`;
