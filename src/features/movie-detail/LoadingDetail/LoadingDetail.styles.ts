import styled from 'styled-components';

import { Skeleton } from '@/primitives';

/**
 * The six blocks this screen's skeleton is drawn from. Each one is sized to the
 * real element it stands in for, which is why they live here rather than beside
 * a browse-home skeleton that traces a completely different picture.
 */
export const SkeletonPoster = styled(Skeleton)`
  width: 300px;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.lg};
`;

export const SkeletonTitle = styled(Skeleton)`
  width: 60%;
  height: 44px;
`;

export const SkeletonMeta = styled(Skeleton)`
  width: 240px;
  height: 20px;
  margin-top: 20px;
`;

export const SkeletonChips = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 18px;
`;

export const SkeletonChip = styled(Skeleton)`
  width: 90px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radius.pill};
`;

export const SkeletonLine = styled(Skeleton)`
  width: 100%;
  max-width: 560px;
  height: 16px;
  margin-top: 14px;
`;
