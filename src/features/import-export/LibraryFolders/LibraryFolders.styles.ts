import styled from 'styled-components';

/**
 * The header is the Maintainer's furniture and the group the Settings
 * furniture, as the Codecs page draws them; what follows is this page's own.
 */
export { HeaderRow, Heading, Lede } from '../../maintainer.styles';
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

/** _Scan folders_, 16px under the accepted shapes. */
export const ScanActions = styled.div`
  display: flex;
  margin-top: 16px;
`;
