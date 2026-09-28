import styled from 'styled-components';

/** The candidate picker: one horizontal, scrolling row. */
export const Picker = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 6px;
  padding: 16px 2px 4px;
  overflow-x: auto;
`;

/** One candidate card: a 132px button on the raised surface. */
export const CandidateCard = styled.button`
  flex: 0 0 auto;
  width: 132px;
  padding: 10px;
  text-align: left;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;
`;

/** The candidate's poster: the Gradient fallback, the TMDB image over it. */
export const Poster = styled.span<{ $g1: string; $g2: string }>`
  display: block;
  width: 100%;
  height: 160px;
  overflow: hidden;
  border-radius: 8px;
  background: ${({ $g1, $g2 }) =>
    `linear-gradient(155deg, ${$g1} 0%, ${$g2} 100%)`};
`;

export const PosterImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const CandidateTitle = styled.span`
  display: block;
  margin-top: 9px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.text};
`;

export const CandidateMeta = styled.span`
  display: block;
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _% match_: the watched green above 70, faint otherwise. */
export const Score = styled.span<{ $strong: boolean }>`
  display: inline-block;
  margin-top: 8px;
  padding: 3px 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ $strong, theme }) =>
    $strong ? theme.colors.watched : theme.colors.textFaint};
  background: ${({ $strong, theme }) =>
    $strong ? 'rgba(138, 154, 107, 0.16)' : theme.colors.surface3};
`;

/** The dashed _Search by title_ card closing the picker. */
export const SearchCard = styled.button`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  gap: 8px;
  width: 132px;
  padding: 16px 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  background: transparent;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;

  &:hover:not(:disabled) {
    color: ${({ theme }) => theme.colors.textDim};
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;
