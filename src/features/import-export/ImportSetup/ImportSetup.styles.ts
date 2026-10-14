import styled from 'styled-components';

import { Button } from '@/primitives';

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

/** The group's head: its label, and _Manage folders_ at the row's end. */
export const GroupHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space.s3};
`;

/**
 * _Manage folders_: the ghost button at the prototype's 34px, on the label's
 * line and the Group heading's 12px above the list, the text ink and surface-2 under hover.
 */
export const ManageButton = styled(Button)`
  && {
    height: 34px;
    padding: 0 12px;
    margin-bottom: ${({ theme }) => theme.space.s3};
    border-radius: ${({ theme }) => theme.radius.sm};
  }

  &&:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface2};
  }
`;

/** The listed folders, one bordered box with a hairline between rows. */
export const FolderList = styled.div`
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

/**
 * One listed folder: the glyph, the path and its line — no ✕, so not the
 * **Folder row** molecule.
 */
export const ListedFolder = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space.s3};
  padding: 13px 14px;
  color: ${({ theme }) => theme.colors.textFaint};

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.borderSoft};
  }

  & > svg {
    flex: 0 0 auto;
  }
`;

/** The path, mono at 14px in the text ink, broken anywhere it must. */
export const FolderPath = styled.span`
  flex: 1;
  min-width: 0px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

/** The title count, or the unreachable word in danger. */
export const FolderLine = styled.span<{ $unreachable: boolean }>`
  flex: 0 0 auto;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ $unreachable, theme }) =>
    $unreachable ? theme.colors.danger : theme.colors.textFaint};
`;

/** None listed: the dashed box holding the line and _Add library folders_. */
export const EmptyFolders = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** _No library folders yet._ at 15px in the dim ink. */
export const EmptyLine = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textDim};
`;
