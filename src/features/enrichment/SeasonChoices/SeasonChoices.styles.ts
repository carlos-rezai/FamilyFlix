import styled from 'styled-components';

import { Artwork } from '@/primitives';
import { CandidateCard } from '../CandidatePicker/CandidatePicker.styles';

export { GroupHeading } from '../../settings/section.styles';
export { Poster, PosterImage } from '../CandidatePicker/CandidatePicker.styles';

/** The Season choices, one card each, 12px apart. */
export const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

/** One Season choice's card, on the surface inside the soft border. */
export const SeasonCard = styled.div`
  padding: 18px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The season's labelled picker: one horizontal, scrolling row. */
export const Picker = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  overflow-x: auto;
  padding: 2px 2px 4px;
`;

/** The held tile and its caption, 112px wide. */
export const Held = styled.div`
  flex: 0 0 auto;
  width: 112px;
`;

/** The 2:3 held tile: the Season poster over the gradient, `S02` on it. */
export const HeldTile = styled.div`
  position: relative;
  width: 112px;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
`;

export const HeldArt = styled(Artwork)`
  position: absolute;
  inset: 0;
`;

export const Numeral = styled.span`
  position: absolute;
  left: 10px;
  bottom: 8px;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
`;

export const HeldCaption = styled.span`
  display: block;
  margin-top: 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The 1px rule between the held tile and the choices. */
export const Rule = styled.div`
  flex: 0 0 1px;
  align-self: stretch;
  background: ${({ theme }) => theme.colors.borderSoft};
`;

/** One choice: `CandidatePicker`'s card, its border the accent line when picked. */
export const ChoiceCard = styled(CandidateCard)<{ $picked: boolean }>`
  border-color: ${({ $picked, theme }) =>
    $picked ? theme.colors.accentLine : theme.colors.borderSoft};

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentLine};
    background: ${({ theme }) => theme.colors.surface3};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.focusRing};
  }
`;

/** _Series poster_: the faint pill under a series' poster. */
export const SeriesPill = styled.span`
  display: inline-block;
  margin-top: 8px;
  padding: 3px 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface3};
`;
