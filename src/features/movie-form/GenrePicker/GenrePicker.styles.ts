import styled from 'styled-components';

/**
 * The row of chips, wrapping onto as many lines as twelve genres need —
 * `feat.MovieForm.dc.html`'s own `flex-wrap` with its `9px` gap, which is the
 * prototype's spacing rather than a step on the token scale.
 */
export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
`;
