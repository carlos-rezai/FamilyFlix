import styled from 'styled-components';

import { Skeleton } from '@/primitives';

export const Poster = styled(Skeleton)`
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: ${({ theme }) => theme.radius.md};
`;

export const Line = styled(Skeleton)`
  width: 70%;
  height: 14px;
  margin-top: 10px;
`;
