import styled, { css } from 'styled-components';

/**
 * The **Content frame**'s box. On, it is capped at the **Content measure** and
 * centred, the page's `bg` showing through the margins with no border or
 * shade; off — or `null`, before the read lands — it is a full-width box that
 * changes nothing. No media query: below the measure the cap is already inert.
 * No transition.
 *
 * Either way it is the containing block for what a screen pins with
 * `position: fixed` — layout containment does that — so the **Back button**
 * and the ⋯ menu sit in the frame's corners, beside the content, rather than
 * out in the margins at the window's edge.
 */
export const Frame = styled.div<{ $capped: boolean }>`
  contain: layout;
  ${({ $capped, theme }) =>
    $capped &&
    css`
      max-width: ${theme.layout.contentMeasure};
      margin-left: auto;
      margin-right: auto;
    `}
`;
