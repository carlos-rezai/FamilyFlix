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
