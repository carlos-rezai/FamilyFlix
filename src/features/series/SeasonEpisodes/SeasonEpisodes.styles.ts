import styled from 'styled-components';

import { LoadMessage } from '@/components';
import { Skeleton } from '@/primitives';
import { controlStates } from '@/styles/interactionStates/interactionStates';

/**
 * The season's content, one centred column at the **Page measure** with the
 * **Maintainer surface**'s padding, so the page reads as it did on that sheet.
 * It holds itself off the sides by the room the pinned Back button needs (the
 * sheet's own padding did that, but padding on the scroller would inset the
 * **Detail backdrop**), and sits above that backdrop, as the series page's
 * content does.
 */
export const Column = styled.div`
  position: relative;
  z-index: 10;
  max-width: min(
    ${({ theme }) => theme.layout.pageMeasure},
    calc(
      100% - 2 *
        (${({ theme }) => `${theme.layout.backSize} + ${theme.space.s4}`})
    )
  );
  margin: 0 auto;
  padding: ${({ theme }) =>
    `${theme.space.s4} ${theme.space.s6} ${theme.space.s8}`};
`;

/** The count line under the heading. */
export const CountRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 22px;
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
