import styled from 'styled-components';

import { Field as TextFieldBox } from '@/primitives/TextField/TextField.styles';

/**
 * The stack of the two fields and the button, from `feat.ImportFlow.dc.html`'s
 * setup block: `18px` is the prototype's own gap and is not a spacing token.
 */
export const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

/**
 * One field — caption, box, and the refusal line when there is one. A
 * `label`, as the **Movie form**'s fields are, so the caption hands a click to
 * its input; the focus ring on the box is the form's own rule too.
 */
export const Field = styled.label`
  display: block;

  ${TextFieldBox}:focus-within {
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** The caption above a field — the prototype's `labelStyle`, as the form draws it. */
export const FieldLabel = styled.span`
  display: block;
  margin-bottom: ${({ theme }) => theme.space.s2};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/**
 * The refusal line: the one invented line in the initiative (design log
 * `13-bulk-import` Q7) — 13px in the danger colour under the field the `400`
 * names, so a sheet that is not there and a root that is not a folder are
 * told apart on the screen.
 */
export const ErrorLine = styled.div`
  margin-top: 6px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;

/** The button's own row, set the prototype's 8px below the last field. */
export const Actions = styled.div`
  margin-top: ${({ theme }) => theme.space.s2};
`;
