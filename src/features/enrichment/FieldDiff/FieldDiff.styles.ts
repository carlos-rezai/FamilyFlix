import styled from 'styled-components';

/** The diff's frame: the rows inside the soft border, clipped to its radius. */
export const Frame = styled.div`
  margin-top: 14px;
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

/** One **Field conflict**: the label, then _Yours_ and _TMDB_. */
export const Row = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.borderSoft};
`;

/** The field's label in a 118px faint cell on `bg2`. */
export const Label = styled.div`
  flex: 0 0 118px;
  padding: 13px 14px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.bg2};
`;

/** One side, the chosen one on `accentSoft` inside an `accentLine` ring. */
export const Side = styled.button<{ $chosen: boolean }>`
  flex: 1;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  background-color: ${({ $chosen, theme }) =>
    $chosen ? theme.colors.accentSoft : 'transparent'};
  border: none;
  border-left: 1px solid ${({ theme }) => theme.colors.borderSoft};
  box-shadow: ${({ $chosen, theme }) =>
    $chosen ? `inset 0 0 0 1px ${theme.colors.accentLine}` : 'none'};
`;

/** _Yours_ or _TMDB_, small, bold and upper-cased over the value. */
export const Caption = styled.span`
  display: block;
  margin-bottom: 4px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export const Value = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  line-height: 1.45;
  color: ${({ theme }) => theme.colors.text};
`;

/** _Apply choices_ then _Keep all mine_. */
export const Actions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 14px;
`;
