import styled from 'styled-components';

/** The row: tile, text block and ✕ in a line — `CodecRow`'s shape. */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 14px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The 40px accent tile the folder glyph sits in. */
export const Tile = styled.div`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
`;

/** The path and the line; `min-width: 0` lets a long path wrap in the row. */
export const Text = styled.div`
  flex: 1;
  min-width: 0px;
`;

/** The path, mono at 14px in the text ink, broken anywhere it must. */
export const Path = styled.div`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};
  overflow-wrap: anywhere;
`;

/**
 * The line under the path: the title count, or the unreachable word in danger.
 */
export const Line = styled.div<{ $unreachable: boolean }>`
  margin-top: 4px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ $unreachable, theme }) =>
    $unreachable ? theme.colors.danger : theme.colors.textFaint};
`;

/** The second line, drawn only with **Left-out videos**: the count and _Bring back_. */
export const LeftOutLine = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** _Bring back_: a bare 13px text button in dim ink, accent under hover. */
export const BringBack = styled.button`
  background: transparent;
  border: none;
  padding: 2px;
  color: ${({ theme }) => theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;
