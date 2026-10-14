import styled from 'styled-components';

/**
 * The stack of the field, the Library folders group and the button, from `feat.ImportFlow.dc.html`'s
 * setup block: `18px` is the prototype's own gap and is not a spacing token.
 */
export const Fields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

/**
 * The field and its caption are the Maintainer's furniture, as the **Movie
 * form** draws them; the setup step adds nothing to either.
 */
export { Field, FieldLabel } from '../../maintainer.styles';

/**
 * The Library folders group's label: the **Group heading**, the Settings
 * furniture — a section's label, where `FieldLabel` captions one input.
 */
export { GroupHeading } from '../../settings/section.styles';

/** The sheet field's row, _Browse…_ beside it: the feature's path furniture. */
export { PathRow } from '../pathField.styles';

/**
 * The refusal line: the one invented line in the initiative (design log
 * `13-bulk-import` Q7) — 13px in the danger colour under the field the `400`
 * names — under the sheet's field, or under the Library folders group.
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
