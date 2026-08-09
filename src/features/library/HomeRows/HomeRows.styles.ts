import styled, { keyframes } from 'styled-components';

import { CARD_WIDTH } from '../CardCarousel/CardCarousel.styles';

/** The centered message layout the prototype uses for an empty result body. */
export const Message = styled.div`
  text-align: center;
  padding: ${({ theme }) => `${theme.space.s8} ${theme.space.s6}`};
  color: ${({ theme }) => theme.colors.textFaint};
  font-family: ${({ theme }) => theme.fonts.sans};
`;

export const MessageTitle = styled.div`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 26px;
  color: ${({ theme }) => theme.colors.textDim};
  margin-bottom: 8px;
`;

export const MessageBody = styled.div`
  font-size: 16px;
`;

export const RetryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  padding: 0 26px;
  margin-top: ${({ theme }) => theme.space.s5};
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  font-family: ${({ theme }) => theme.fonts.sans};
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    border-color: ${({ theme }) => theme.colors.textFaint};
  }
`;

const pulse = keyframes`
  from { opacity: 0.45; }
  to { opacity: 0.8; }
`;

/** Every skeleton block breathes on the same beat. */
const Block = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.sm};
  animation: ${pulse} 1.1s ease-in-out infinite alternate;
`;

export const SkeletonSection = styled.div`
  margin-bottom: ${({ theme }) => theme.space.s7};
`;

export const SkeletonHeader = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: ${({ theme }) => `0 ${theme.space.s6}`};
  margin: ${({ theme }) => `0 0 ${theme.space.s4}`};
`;

export const SkeletonTitle = styled(Block)`
  width: 160px;
  height: 24px;
`;

export const SkeletonViewAll = styled(Block)`
  width: 90px;
  height: 16px;
`;

export const SkeletonStrip = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space.s5};
  overflow: hidden;
  padding: ${({ theme }) => `4px ${theme.space.s6} ${theme.space.s5}`};
`;

export const SkeletonCard = styled.div`
  flex: 0 0 auto;
  width: ${`${CARD_WIDTH}px`};
`;

export const SkeletonPoster = styled(Block)`
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.md};
`;

export const SkeletonLine = styled(Block)`
  width: 70%;
  height: 14px;
  margin-top: 10px;
`;
