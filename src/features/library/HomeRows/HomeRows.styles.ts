import styled from 'styled-components';

import { Skeleton } from '@/primitives';
import { CARD_WIDTH } from '../CardCarousel/CardCarousel.styles';

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

export const SkeletonTitle = styled(Skeleton)`
  width: 160px;
  height: 24px;
`;

export const SkeletonViewAll = styled(Skeleton)`
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

export const SkeletonPoster = styled(Skeleton)`
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.md};
`;

export const SkeletonLine = styled(Skeleton)`
  width: 70%;
  height: 14px;
  margin-top: 10px;
`;
