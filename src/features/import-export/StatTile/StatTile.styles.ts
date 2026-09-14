import styled from 'styled-components';

/** The two inks a tile's number can take, and the border each one sits in. */
export type StatTone = 'watched' | 'accent';

/**
 * The tile: on the surface, 22px inside, on the card radius. The `watched`
 * tile sits in the soft border; the `accent` tile in the accent line, so the
 * count that needs the maintainer is the one that is outlined.
 */
export const Tile = styled.div<{ $tone: StatTone }>`
  flex: 1;
  padding: 22px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid
    ${({ $tone, theme }) =>
      $tone === 'accent' ? theme.colors.accentLine : theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The number: 40px serif, bold, tight, in the tile's tone. */
export const Value = styled.div<{ $tone: StatTone }>`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 700;
  font-size: 40px;
  line-height: 1;
  color: ${({ $tone, theme }) => theme.colors[$tone]};
`;

/** The label under the number, in the dim sans. */
export const Label = styled.div`
  margin-top: 6px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textDim};
`;
