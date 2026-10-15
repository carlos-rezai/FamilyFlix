import styled from 'styled-components';

import { controlStates } from '@/styles/interactionStates/interactionStates';

/** The row card the Accordion rests on — the Problem row's surface. */
export const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

/** The header row: the toggle, then the caller's actions beside it. */
export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 8px;
`;

/** The toggle — a **Control**: its fill shifts on hover, darkens on press. */
export const Toggle = styled.button`
  appearance: none;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: transparent;
  border: none;
  border-radius: ${({ theme }) => theme.radius.md};
  text-align: left;
  cursor: pointer;

  ${controlStates('scale(.98)')}

  &:hover {
    background: ${({ theme }) => theme.colors.surface2};
  }

  &&:active:not(:disabled) {
    background: ${({ theme }) => theme.colors.surface3};
  }
`;

/** The 16px faint chevron, right while closed and turned down while open. */
export const Chevron = styled.svg<{ $expanded: boolean }>`
  flex: 0 0 auto;
  color: ${({ theme }) => theme.colors.textFaint};
  transform: ${({ $expanded }) => ($expanded ? 'rotate(90deg)' : 'none')};
  transition: transform ${({ theme }) => theme.motion.durBase}
    ${({ theme }) => theme.motion.easeOut};
`;

/** The label: 16px 600, ellipsed. */
export const Label = styled.span`
  min-width: 0;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** The caller's marks, 6px apart. */
export const Marks = styled.span`
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

/** The count as the faint pill. */
export const Count = styled.span`
  flex: 0 0 auto;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.colors.textFaint};
  background: ${({ theme }) => theme.colors.surface3};
`;

/** The caller's actions, beside the toggle. */
export const Actions = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
`;

/** The body: its rows under the label, 10px apart. */
export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 16px 16px 44px;
`;
