import styled from 'styled-components';

import { Field as TextFieldBox } from '@/primitives/TextField/TextField.styles';

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
 * The one phrase in that line that names another screen. Lifted out of the
 * faint text around it, and deliberately not a link: **Import library** does
 * not exist yet, and a link to nowhere is worse than a name.
 */
export const Emphasis = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
  font-weight: 500;
`;

/**
 * The stack of fields. `22px` is the prototype's own gap and is not a spacing
 * token; the values it does share with the scale are written as tokens above.
 * The gap above it is the lede's, as the prototype sets it, not this block's.
 */
export const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
`;

/** Two fields side by side, the way the prototype pairs Title with Year. */
export const FieldRow = styled.div`
  display: flex;
  gap: 18px;
`;

/**
 * One captioned field. A `label` rather than a `div`, so the caption is part of
 * the control: clicking "Year" puts the caret in the year box.
 *
 * The focus state is the form's, not the primitive's: `feat.MovieForm.dc.html`
 * is the one file in the handoff that declares a `style-focus`, and it declares
 * it on each of its four inputs — the box takes the accent line while it has
 * focus. A component selector reaches `TextField`'s box on `SubtitleRow`'s
 * precedent with `Menu`'s panel, and for the same reason: threading this
 * through the primitive would put a prop on it that only one caller could set.
 * `:focus-within` because the box is a `div` around the input, and the input is
 * what focuses. The browser's ring stays beside it, per `TextField.styles.ts`.
 * The Description under these is a `Textarea`, which the prototype gives no
 * focus state — so this selector deliberately does not reach it.
 */
export const Field = styled.label`
  display: block;
  flex: 1;

  ${TextFieldBox}:focus-within {
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** Year is the one field with a fixed measure — a year is four characters wide. */
export const NarrowField = styled(Field)`
  flex: 0 0 150px;
`;

/**
 * The one field that is a row of its own — the Description, which the prototype
 * gives the full width of the column rather than a place in a pair.
 *
 * `Field`'s `flex: 1` is undone rather than inherited: that value is what makes
 * two fields share a `FieldRow`, and this one's parent is the column itself, so
 * growing into it would stretch the box past the 96px the textarea opens at.
 */
export const WideField = styled(Field)`
  flex: 0 0 auto;
`;

/**
 * A field whose control is not a form element — the genre chips, and the rating
 * picker under them. A `div` rather than the `label` above it: a label wrapping
 * twelve buttons has no single control to hand a click to, and clicking its
 * caption would activate the first chip — or, on the strip, score the movie half
 * a star.
 */
export const ChipField = styled.div`
  display: block;
`;

/** The caption above a field. */
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
 * The lighter half of a caption — the prototype's "— pick one or more", "—
 * separate with commas" and "— click a star (or half)". Faint and unbolded
 * inside a caption that is neither, so it reads as an aside rather than as part
 * of the field's name.
 */
export const FieldHint = styled.span`
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * The gap the prototype leaves between a caption and a control that is not a
 * field box — the chips sit `4px` under theirs, where a `TextField` carries its
 * own spacing above it.
 */
export const UnderCaption = styled.div`
  margin-top: 4px;
`;

/**
 * Where the form's buttons sit: Save first, where the eye lands, and Cancel
 * beside it. The gate closes Save and never the way out — a form the maintainer
 * cannot finish is exactly the form they most need to leave.
 */
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: ${({ theme }) => theme.space.s6};
`;
