import styled from 'styled-components';

import { Field as MaintainerField, FieldLabel } from '../../maintainer.styles';

/**
 * The accent banner the **Import context** draws above the heading —
 * `feat.MovieForm.dc.html`'s `inImportContext` block: the accent's soft fill
 * and line, on the mid radius, 20px above the header row. Its two spans are
 * laid out with the prototype's own 12px gap.
 */
export const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
  background: ${({ theme }) => theme.colors.accentSoft};
  border: 1px solid ${({ theme }) => theme.colors.accentLine};
  border-radius: ${({ theme }) => theme.radius.md};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
`;

/** "Resolving import" — the accent, bold. */
export const BannerLead = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`;

/** The problem's title, dimmed beside it. */
export const BannerTitle = styled.span`
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The header is the Maintainer's furniture; nothing here is the form's own. */
export { HeaderRow, Heading, Lede } from '../../maintainer.styles';

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
 * The Maintainer's captioned field, which here shares a `FieldRow` with a
 * sibling: `flex: 1` is what makes Title and Director take the width Year
 * and the column edge leave them.
 */
export const Field = styled(MaintainerField)`
  flex: 1;
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

/** The caption is the furniture's; the hint inside it is the form's own. */
export { FieldLabel };

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
