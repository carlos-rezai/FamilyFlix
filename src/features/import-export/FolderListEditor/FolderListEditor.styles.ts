import styled from 'styled-components';

/** The card and its divider are the Settings furniture. */
export { Card, Divider } from '../../settings/section.styles';

/** The add row and a refused path's line are the feature's path furniture. */
export { PathRow, Refusal } from '../pathField.styles';

/** The Folder rows, stacked 8px apart. */
export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/** _No folders yet._ — 14px in the faint ink. */
export const Empty = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textFaint};
`;
