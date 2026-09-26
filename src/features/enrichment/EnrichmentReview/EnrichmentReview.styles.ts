import styled from 'styled-components';

/** The review's blocks, 20px apart. */
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

/** The two stat tiles in a wrapping row. */
export const Tiles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

/** One stat tile, on the surface inside the soft border. */
export const Tile = styled.div`
  flex: 1;
  min-width: 190px;
  padding: 18px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** A tile's number: serif, 30px — the accent on the first. */
export const TileValue = styled.div<{ $accent: boolean }>`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 30px;
  font-weight: 600;
  color: ${({ $accent, theme }) =>
    $accent ? theme.colors.accent : theme.colors.text};
`;

export const TileLabel = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The _All done_ card: centred, on the surface. */
export const AllDone = styled.div`
  padding: 26px;
  text-align: center;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

export const AllDoneHeading = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 21px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const AllDoneLine = styled.div`
  margin: 6px 0 4px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** Finish and _Sync again_. */
export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;
