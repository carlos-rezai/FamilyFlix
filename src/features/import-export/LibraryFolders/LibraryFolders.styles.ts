import styled from 'styled-components';

/**
 * The header is the Maintainer's furniture and the group the Settings
 * furniture, as the Codecs page draws them; what follows is this page's own.
 */
export { HeaderRow, Heading, Lede } from '../../maintainer.styles';
export { Card, Divider, GroupHeading } from '../../settings/section.styles';

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

/** The add row: the field taking the width, _Add_ beside it. */
export const AddRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  & > :first-child {
    flex: 1;
    min-width: 0px;
  }
`;

/** A refused add's one sentence, a 13px `danger` line under the field. */
export const Refusal = styled.p`
  margin: 8px 0 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;

/** _Scan folders_, 16px under the accepted shapes. */
export const ScanActions = styled.div`
  display: flex;
  margin-top: 16px;
`;
