import styled from 'styled-components';

import { Field as TextFieldBox } from '@/primitives/TextField/TextField.styles';

/**
 * The furniture the Maintainer's screens share: the captioned field, the
 * prototype's one `labelStyle` over a `TextField` box that takes the accent
 * line while it has focus. The header those screens open with is the
 * `PageHeader` molecule, one for every column screen.
 *
 * This is the features rung's furniture rather than any one feature's, on
 * `layouts/chrome.styles.ts`'s precedent: every block here was written twice,
 * character for character. Not a molecule: the prototype has no `mol.*` for a
 * labelled field — it is a container-level style handed to the features,
 * which is what a furniture file is.
 */

/**
 * One captioned field. A `label` rather than a `div`, so the caption is part of
 * the control: clicking "Year" puts the caret in the year box.
 *
 * The focus state is the screen's, not the primitive's: `feat.MovieForm.dc.html`
 * is the one file in the handoff that declares a `style-focus`, and it declares
 * it on each of its inputs — the box takes the accent line while it has focus
 * — and the import's setup fields draw the same. A component selector reaches
 * `TextField`'s box on `SubtitleRow`'s precedent with `Menu`'s panel, and for
 * the same reason: threading this through the primitive would put a prop on it
 * that only these callers could set. `:focus-within` because the box is a `div`
 * around the input, and the input is what focuses. The browser's ring stays
 * beside it, per `TextField.styles.ts`. A `Textarea` gets no focus state in
 * the prototype, so this selector deliberately does not reach one.
 */
export const Field = styled.label`
  display: block;

  ${TextFieldBox}:focus-within {
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** The caption above a field — the prototype's `labelStyle`. */
export const FieldLabel = styled.span`
  display: block;
  margin-bottom: ${({ theme }) => theme.space.s2};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: ${({ theme }) => theme.colors.textDim};
`;
