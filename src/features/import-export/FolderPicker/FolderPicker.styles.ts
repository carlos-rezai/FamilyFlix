import styled from 'styled-components';

/** The picker: one horizontal, scrolling row, inset under the row's head. */
export const Picker = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px 2px 4px 24px;
  overflow-x: auto;
`;

/** One **Candidate folder**: a 220px button on the raised surface. */
export const FolderCard = styled.button`
  flex: 0 0 auto;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 220px;
  padding: 12px;
  text-align: left;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accentLine};
    background: ${({ theme }) => theme.colors.surface3};
  }
`;

/** The folder glyph's 32px accent tile. */
export const Glyph = styled.span`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.accentSoft};
  color: ${({ theme }) => theme.colors.accent};
`;

export const Body = styled.span`
  flex: 1;
  min-width: 0;
`;

export const Name = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: ${({ theme }) => theme.colors.text};
`;

/** The folder's path, in mono. */
export const Path = styled.span`
  display: block;
  margin-top: 3px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
  overflow-wrap: anywhere;
`;

/** The video count, as a pill. */
export const Videos = styled.span`
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
