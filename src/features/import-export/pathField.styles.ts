import styled from 'styled-components';

/**
 * The path field's furniture: the row a typed path sits in and the one line a
 * refused path is answered with. The **Library folders page**'s add row and
 * the **Export dialog**'s _Save to_ both draw with it.
 *
 * This is the feature's furniture rather than either organism's, on
 * `movie-form/filesCard.styles.ts`' precedent: both blocks were written twice,
 * declaration for declaration. Each organism's styles re-export it, so neither
 * makes the other's styles its public surface.
 */

/** A path's row: the field taking the width, its buttons beside it. */
export const PathRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  & > :first-child {
    flex: 1;
    min-width: 0px;
  }
`;

/** A refused path's one sentence, a 13px `danger` line under the field. */
export const Refusal = styled.p`
  margin: 8px 0 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;
