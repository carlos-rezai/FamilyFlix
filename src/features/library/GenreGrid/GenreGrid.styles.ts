import styled from 'styled-components';

import { Skeleton } from '@/primitives';
import { Grid } from '../LibraryGrid/LibraryGrid.styles';

/**
 * The first load, laid out on the grid it is about to become. It reuses
 * `LibraryGrid`'s own `Grid` rather than restating the track sizing, so the
 * placeholders sit exactly where the posters will land and nothing shifts under
 * the eye when they do.
 */
export const SkeletonGrid = styled(Grid)``;

export const SkeletonCard = styled.div``;

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
