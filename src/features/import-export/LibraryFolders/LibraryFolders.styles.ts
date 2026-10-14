import styled from 'styled-components';

/**
 * The group is the Settings furniture, as the Codecs page draws it; what
 * follows is this page's own.
 */
export { Card, Divider, GroupHeading } from '../../settings/section.styles';

/** The add row and a refused add's line are the feature's path furniture. */
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

/**
 * The group Scan's stack — the accepted shapes, the Import mode, the TMDB box
 * and _Scan folders_ — the prototype's 16px apart.
 */
export const ScanStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/** _Scan folders_' own row, so the button keeps its width in the column. */
export const ScanActions = styled.div`
  display: flex;
`;
