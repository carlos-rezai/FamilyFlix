import styled from 'styled-components';

/**
 * The furniture the **Clear dialog** and the **Delete dialog** share — one
 * handoff card for both — flat as `movie-form/filesCard.styles.ts` is: the
 * title's path in the mono well and the two buttons. **What goes** beside
 * **What stays** is `GoesAndStays`'. Neither dialog owns it; both import it.
 */

/** The title's path in the mono well, `page.ManageLibraryPage.dc.html`. */
export const PathWell = styled.div`
  padding: 12px 14px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: 9px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textDim};
  overflow-wrap: anywhere;
`;

/** The two buttons, the confirm first. */
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
`;
