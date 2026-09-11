import styled from 'styled-components';

/**
 * The ✕, as `mol.FileField.dc.html` and `mol.SubtitleRow.dc.html` both draw
 * it: a 32px square on a 7px corner, in the faintest ink until it is hovered,
 * when it turns the danger colour over a tint of the same.
 *
 * The tint is the prototype's own `rgba(201,122,106,.1)` — the danger colour
 * at a tenth — written literally because the prototype writes it inline and
 * there is no token behind it. `7px` is likewise the prototype's own corner,
 * not a radius token.
 */
export const Root = styled.button`
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 7px;
  color: ${({ theme }) => theme.colors.textFaint};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.danger};
    background: rgba(201, 122, 106, 0.1);
  }
`;
