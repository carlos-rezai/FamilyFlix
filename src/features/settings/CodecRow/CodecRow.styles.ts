import styled from 'styled-components';

import type { CodecSupport } from '@/types';

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

/** The size cell, right-aligned mono in the faint ink — a dash on every row. */
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

/**
 * The **Status pill**: _Built-in_ in the faint ink on the third surface, or
 * _Installed_ in the watched green on its own tint.
 */
export const Pill = styled.span<{ $support: CodecSupport }>`
  flex: 0 0 auto;
  padding: 4px 11px;
  border-radius: ${({ theme }) => theme.radius.pill};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 600;
  color: ${({ $support, theme }) =>
    $support === 'native' ? theme.colors.textFaint : theme.colors.watched};
  background: ${({ $support, theme }) =>
    $support === 'native' ? theme.colors.surface3 : INSTALLED_TINT};
  border: 1px solid
    ${({ $support, theme }) =>
      $support === 'native' ? theme.colors.border : INSTALLED_LINE};
`;

/** The 32px the prototype's ✕ would take, kept so the pills line up. */
export const Spacer = styled.span`
  flex: 0 0 auto;
  width: 32px;
`;
