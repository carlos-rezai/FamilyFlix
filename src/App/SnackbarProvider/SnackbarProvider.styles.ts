import styled, { css } from 'styled-components';

/**
 * The **Snackbar stack**: fixed bottom-right at `z-index: 200`, clearing the
 * Modal's scrim at 90 and the header at 40. The prototype's `absolute` becomes
 * `fixed` for the reason the scrim's did. A reversed column, so an array
 * appended to — oldest-first in the document — puts the newest nearest the
 * corner. `pointer-events: none` so an empty stack, and the gaps in a full
 * one, cover nothing; each card's wrapper restores them.
 *
 * `$framed` while **Ultrawide margins** is on: `right` follows the **Content
 * frame**'s bottom-right corner on a window wider than the **Content
 * measure**, and the window's own corner on a narrower one. Nothing else moves.
 */
export const Stack = styled.div<{ $framed: boolean }>`
  position: fixed;
  right: ${({ theme }) => theme.space.s5};
  ${({ $framed, theme }) =>
    $framed &&
    css`
      right: max(
        ${theme.space.s5},
        calc((100vw - ${theme.layout.contentMeasure}) / 2 + ${theme.space.s5})
      );
    `}
  bottom: ${({ theme }) => theme.space.s5};
  z-index: 200;
  display: flex;
  flex-direction: column-reverse;
  gap: ${({ theme }) => theme.space.s3};
  align-items: flex-end;
  pointer-events: none;
`;

/** One card's wrapper: the pointer events the stack let through, taken back. */
export const Slot = styled.div`
  pointer-events: auto;
`;
