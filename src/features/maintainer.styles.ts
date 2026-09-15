import styled from 'styled-components';

import { Field as TextFieldBox } from '@/primitives/TextField/TextField.styles';

/**
 * The furniture the Maintainer's screens share: the header a screen opens
 * with — the back pill and the heading on one row, and the lede under them —
 * as `feat.MovieForm.dc.html` and `feat.ImportFlow.dc.html` both draw it,
 * and `feat.SettingsHeader.dc.html` draws a pixel and a `flex: 1` apart; and
 * the captioned field, the prototype's one `labelStyle` over a `TextField`
 * box that takes the accent line while it has focus.
 *
 * This is the features rung's furniture rather than any one feature's, on
 * `layouts/chrome.styles.ts`'s precedent: every block here was written
 * twice, character for character, and the header a third time nearly so. In
 * the prototype they are one header and one label style the container hands
 * to each screen. Each feature extends these and states only what is
 * genuinely its own; none owns them. Not molecules: the prototype has no
 * `mol.*` for a page header or a labelled field — these are container-level
 * styles handed to the features, which is what a furniture file is.
 */

/** The back pill and the heading, read as one group. */
export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s4};
  margin-bottom: ${({ theme }) => theme.space.s2};
`;

/** Serif and large — the one heading on the screen. */
export const Heading = styled.h1`
  margin: 0;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 30px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/**
 * The line under the heading — what this screen is for, said once, indented to
 * clear the back pill the way the prototype sets it.
 */
export const Lede = styled.p`
  margin: 0 0 28px 58px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

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
