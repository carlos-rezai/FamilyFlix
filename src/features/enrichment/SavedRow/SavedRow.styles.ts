import styled from 'styled-components';

/** One row of _Where it is saved_: the glyph tile, the two lines, the badge. */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
`;

/** The row's 38px glyph tile. */
export const Glyph = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.surface3};
  color: ${({ theme }) => theme.colors.textDim};
`;

/** The title and the line, taking the width the tile and badge do not. */
export const Text = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Title = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** A plain line under the title: _Your library_'s. */
export const Line = styled.div`
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** A path under the title, in mono, clipped to one line: _Your library folders_'. */
export const Path = styled.div`
  margin-top: 3px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** _Required_ or _Always_ at the row's end. */
export const Badge = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface3};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 4px 11px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;
