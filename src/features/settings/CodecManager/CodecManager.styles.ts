import styled from 'styled-components';

import { Card } from '../section.styles';

/**
 * The header is the Maintainer's furniture (`features/maintainer.styles.ts`),
 * drawn as `ImportFlow` and `EnrichmentFlow` draw theirs; the groups under it
 * are Settings' own (`section.styles.ts`).
 */
export { HeaderRow, Heading, Lede } from '../../maintainer.styles';
export { GroupHeading } from '../section.styles';

/**
 * One group's **Section card**, its contents stacked the prototype's 14px
 * apart: the Component row over the zone, or the summary over the rows.
 */
export const GroupCard = styled(Card)<{ $last?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: ${({ $last }) => ($last ? '0' : '32px')};
`;

/** The **Codec summary**, 13px in the faint ink. */
export const Summary = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The rows, stacked 8px apart. */
export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
