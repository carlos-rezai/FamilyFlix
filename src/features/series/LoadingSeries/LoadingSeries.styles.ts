import styled from 'styled-components';

import { Skeleton } from '@/primitives';

export const SkeletonPoster = styled(Skeleton)`
  width: 260px;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.lg};
`;

export const SkeletonTitle = styled(Skeleton)`
  width: 60%;
  height: 44px;
`;

export const SkeletonLine = styled(Skeleton)`
  width: 100%;
  max-width: 560px;
  height: 16px;
  margin-top: 14px;
`;
