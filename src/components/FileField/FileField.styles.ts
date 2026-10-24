import styled from 'styled-components';

import { Filename } from '../fileRow.styles';

/**
 * The filled state: the file that is in the slot, on the soft box the molecule
 * rung shares (`fileRow.styles.ts`): the box, its glyph and its filename are
 * the furniture's under this slot's own name.
 */
export { Row as Filled, IconSlot, Filename } from '../fileRow.styles';

/**
 * The name ellipsised from its start (`truncateStart`): right to left, so the
 * ellipsis lands before the name, its text left-aligned as the prototype has.
 */
export const StartTruncated = styled(Filename)`
  direction: rtl;
  text-align: left;
`;

/** The slot: its name on the left, its one control filling the rest. */
export const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s3};
`;

/**
 * The slot's name — a fixed 70px measure, so the controls of a column of these
 * line up with each other rather than with their own captions.
 */
export const Label = styled.span`
  flex: 0 0 70px;
  padding-top: 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** Whichever of the two controls the slot is showing. */
export const Control = styled.div`
  flex: 1;
  min-width: 0;
`;
