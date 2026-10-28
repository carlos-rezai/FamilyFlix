import styled from 'styled-components';

/**
 * The group heading is the Settings furniture, as the Codecs page draws it;
 * what follows is this page's own.
 */
export { GroupHeading } from '../../settings/section.styles';

/**
 * The group Scan's stack — the accepted shapes, the Import mode, the TMDB box
 * and the two scan presses, the prototype's 16px apart.
 */
export const ScanStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

/**
 * _Scan new folders_ and _Scan all folders_' own row, 12px apart and wrapping
 * on a narrow window, so each keeps its width in the column.
 */
export const ScanActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;
