import styled from 'styled-components';

import { controlStates } from '@/styles/interactionStates/interactionStates';

/** The pill track the two tabs sit in — `page.LibraryPage.dc.html`. */
export const Track = styled.div`
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
  padding: 4px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.pill};
`;

/**
 * One tab, the prototype's `tabStyle`: the accent pill when active, transparent
 * at rest. A **Control** — the Press and the Focus ring off `controlStates`.
 */
export const Tab = styled.button<{ $active: boolean }>`
  appearance: none;
  height: 38px;
  padding: 0 20px;
  background: ${({ theme, $active }) =>
    $active ? theme.colors.accent : 'transparent'};
  border: none;
  border-radius: ${({ theme }) => theme.radius.pill};
  /* Near-black warm ink on the accent — the primary Button's literal. */
  color: ${({ theme, $active }) =>
    $active ? '#1a1109' : theme.colors.textFaint};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  cursor: pointer;

  ${controlStates('scale(.97)')}
`;
