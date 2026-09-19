import styled from 'styled-components';

import type { CodecRowStatus } from '../codecView/codecView';

/** The row: tile, text block, size cell, pill and spacer in a line. */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 14px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
`;

/** The 38px tile the microchip glyph sits in, on the second surface. */
export const Tile = styled.div`
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 9px;
  background: ${({ theme }) => theme.colors.surface2};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textFaint};
`;

/**
 * The name and the chips. `min-width: 0` is what lets a long name wrap inside
 * the row rather than widen it past the list.
 */
export const Text = styled.div`
  flex: 1;
  min-width: 0px;
`;

/** The display name, 15px semibold in the text ink. */
export const Name = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

/** The chips, wrapping, under the name. */
export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 5px;
`;

/** One **Container chip**: mono at 11.5px in the dim ink, on the surface. */
export const Chip = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 11.5px;
  color: ${({ theme }) => theme.colors.textDim};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 2px 8px;
  border-radius: 6px;
`;

/**
 * The size cell, right-aligned mono in the faint ink: a dash on a codec row,
 * the pair's weight on the **Component row**.
 */
export const Size = styled.span`
  flex: 0 0 auto;
  min-width: 54px;
  text-align: right;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The watched green's tint and line, the prototype's own rgba over it. */
const INSTALLED_TINT = 'rgba(138, 154, 107, 0.16)';
const INSTALLED_LINE = 'rgba(138, 154, 107, 0.3)';

/** The two words for what the machine came with: faint, on the third surface. */
const CAME_WITH: readonly CodecRowStatus[] = ['built-in', 'default'];

/**
 * The **Status pill**, in the prototype's two colourings over four words:
 * _Built-in_ and _Default_ — what the machine came with — in the faint ink on
 * the third surface, _Installed_ and _Uploaded_ in the watched green on its
 * own tint.
 */
export const Pill = styled.span<{ $status: CodecRowStatus }>`
  flex: 0 0 auto;
  padding: 4px 11px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  color: ${({ $status, theme }) =>
    CAME_WITH.includes($status)
      ? theme.colors.textFaint
      : theme.colors.watched};
  background: ${({ $status, theme }) =>
    CAME_WITH.includes($status) ? theme.colors.surface3 : INSTALLED_TINT};
  border: 1px solid
    ${({ $status, theme }) =>
      CAME_WITH.includes($status) ? theme.colors.border : INSTALLED_LINE};
`;

/**
 * The 32px the ✕ takes, kept as a spacer so the pills line up without one.
 * The ✕ itself is `primitives/RemoveButton`, which is this same 32px square on
 * the prototype's 7px corner — the atom two molecules already share.
 */
export const Spacer = styled.span`
  flex: 0 0 auto;
  width: 32px;
`;
