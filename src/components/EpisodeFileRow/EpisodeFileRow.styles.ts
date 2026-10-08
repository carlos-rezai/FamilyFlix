import styled, { css } from 'styled-components';

import { Filename as FileRowFilename, Row } from '../fileRow.styles';

/**
 * The row, from `mol.EpisodeFileRow.dc.html`: the filled slot's soft box
 * (`fileRow.styles.ts`), stacked — the controls, the filename, the children.
 */
export const Card = styled(Row)`
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
`;

/** The controls' line: S, E, the title and the ✕. */
export const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

/** The `S` / `E` label wrapping its number field. */
export const Tag = styled.label`
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const field = css`
  height: 34px;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 7px;
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.colors.accentLine};
  }
`;

/** A season or episode number: 44px, centred. */
export const NumberInput = styled.input`
  ${field}
  width: 44px;
  padding: 0 8px;
  text-align: center;
`;

/** The episode's title, taking what the line has left. */
export const TitleInput = styled.input`
  ${field}
  flex: 1;
  min-width: 0;
  padding: 0 10px;
`;

/** The filename on its own line, in mono, under the controls. */
export const Filename = styled(FileRowFilename)`
  flex: 0 1 auto;
`;

/** The children slot: the row's subtitles. */
export const Children = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
