import styled from 'styled-components';

import { LoadMessage } from '@/components';
import { Skeleton } from '@/primitives';
import { controlStates } from '@/styles/interactionStates/interactionStates';

/** The centred 980px column of `page.SeasonPage`. */
export const Column = styled.div`
  max-width: 980px;
  margin: 0 auto;
  padding: ${({ theme }) =>
    `${theme.space.s6} ${theme.space.s6} ${theme.space.s8}`};
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
`;

export const HeaderText = styled.div`
  flex: 1;
  min-width: 0;
`;

export const Eyebrow = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export const Heading = styled.h1`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-weight: 600;
  font-size: 30px;
  color: ${({ theme }) => theme.colors.text};
  margin: 2px 0 0;
`;

/** The count line, indented under the heading past the Back button. */
export const CountRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 22px 58px;
  flex-wrap: wrap;
`;

export const CountText = styled.span`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export const Spacer = styled.span`
  flex: 1;
`;

/** _Mark season watched_ — a **Control**, signalling with colour. */
export const ToggleAllButton = styled.button`
  height: 38px;
  padding: 0 16px;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 9px;
  color: ${({ theme }) => theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  ${controlStates('scale(.98)')}

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.textFaint};
    color: ${({ theme }) => theme.colors.text};
  }
`;

export const EpisodeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const OtherSeasons = styled.div`
  margin-top: ${({ theme }) => theme.space.s7};
`;

export const OtherSeasonsHeading = styled.div`
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
  margin: 0 0 12px 2px;
`;

export const Pills = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

/** One _Other seasons_ pill — a **Control**. */
export const SeasonPill = styled.button`
  height: 44px;
  padding: 0 18px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.borderSoft};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.colors.textDim};
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;

  ${controlStates('scale(.97)')}

  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.accentLine};
    color: ${({ theme }) => theme.colors.text};
  }
`;

/** A placeholder the height of one Episode row. */
export const SkeletonRow = styled(Skeleton)`
  height: 118px;
  margin-bottom: 10px;
  border-radius: ${({ theme }) => theme.radius.md};
`;

export const Message = styled(LoadMessage)`
  position: relative;
`;
