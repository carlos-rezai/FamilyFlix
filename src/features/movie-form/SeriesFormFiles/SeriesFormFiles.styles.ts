import styled from 'styled-components';

/**
 * The series' Files card draws on the form's Files card furniture
 * (`filesCard.styles.ts`): the card, its caption, and its **Episode file
 * rows** in the list section. Its own is the _Season posters_ list.
 */
export {
  Card,
  Caption,
  ListSection as Episodes,
  ListLabel as EpisodesLabel,
  ListRows as EpisodeRows,
} from '../filesCard.styles';

/** The _Season posters_ list: its caption over one File field per season. */
export const SeasonPosters = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.s2};
`;

/**
 * The list's caption, lined up with the slots' controls: the 70px label
 * measure and the 12px gap beside it, as the prototype writes them.
 */
export const SeasonPostersLabel = styled.div`
  padding-left: 82px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * _＋ Add show folder_: the File picker's dashed 42px box, as a `<button>` —
 * it opens the **Folder bridge**'s dialog, not a file input.
 */
export const AddShowFolder = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 42px;
  background: transparent;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.text};
  }
`;
