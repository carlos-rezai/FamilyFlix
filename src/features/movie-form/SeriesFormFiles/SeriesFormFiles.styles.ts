import styled from 'styled-components';

/** The card and its caption are the movie's, so the two kinds read as one form. */
export { Card, Caption } from '../MovieFormFiles/MovieFormFiles.styles';

/**
 * The episodes section: its name on the left, its rows filling the rest —
 * the movie card's subtitle arrangement, at the series' one list.
 */
export const Episodes = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s3};
`;

/** The section's name, on the 70px measure every slot on the card uses. */
export const EpisodesLabel = styled.span`
  flex: 0 0 70px;
  padding-top: 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The rows and the ＋ under them, filling what the label leaves. */
export const EpisodeRows = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.s2};
`;
