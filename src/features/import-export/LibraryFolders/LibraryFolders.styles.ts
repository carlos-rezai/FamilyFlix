import styled from 'styled-components';

/**
 * The group heading is the Settings furniture, as the Codecs page draws it;
 * what follows is this page's own.
 */
export { GroupHeading } from '../../settings/section.styles';

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
