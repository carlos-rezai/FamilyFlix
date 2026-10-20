import styled from 'styled-components';

import { controlStates } from '@/styles/interactionStates/interactionStates';

import type { DotTone } from '../libraryTitleView/libraryTitleView';

/** The row: tile and text block in a line — the **Folder row**'s furniture. */
export const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 14px 14px 16px;
  background: ${({ theme }) => theme.colors.surface};
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

/** The text block; `min-width: 0` lets a long path wrap in the row. */
export const Text = styled.div`
  flex: 1;
  min-width: 0px;
`;

/** The title and its year, on one baseline. */
export const Heading = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
`;

export const Title = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

export const Year = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

/** The path, mono at 13px, broken anywhere it must. */
export const Path = styled.div`
  margin-top: 3px;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textFaint};
  overflow-wrap: anywhere;
`;

/** The badge, the files and the dot, in a line under the path. */
export const Meta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textDim};
`;

/** _Linked_ / _Copied_. */
export const Badge = styled.span`
  padding: 2px 8px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textDim};
  background: ${({ theme }) => theme.colors.surface3};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.pill};
`;

export const Separator = styled.span`
  color: ${({ theme }) => theme.colors.border};
`;

/** The Details state's dot and words. */
export const State = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

export const Dot = styled.span<{ $tone: DotTone }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ $tone, theme }) => theme.colors[$tone]};
`;

/** _Can’t be reached right now_, in danger. */
export const Unreachable = styled.div`
  margin-top: 4px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.danger};
`;

/**
 * The row's controls at its right edge. The panel hangs under the 40px
 * trigger at the handoff's 220px, rather than under the ⋯ corner's 44px.
 */
export const Actions = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;

  [role='menu'] {
    top: 46px;
    min-width: 220px;
  }
`;

/**
 * _Edit ▾_: `Button`'s secondary sm face with a trailing chevron, in the
 * `FilterDropdown` trigger's shape — a trigger of its own, because `Menu` hands
 * its trigger a ref and the two ARIA attributes, which `Button` does not take.
 */
export const EditTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px 0 18px;
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  ${controlStates('scale(.98)')}

  &:hover {
    background: ${({ theme }) => theme.colors.surface2};
    border-color: ${({ theme }) => theme.colors.textFaint};
  }

  &:active {
    background: ${({ theme }) => theme.colors.surface3};
  }
`;

/** The trailing caret. Decorative, so the control is named _Edit_. */
export const Chevron = styled.span`
  color: ${({ theme }) => theme.colors.textFaint};
`;
