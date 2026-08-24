import styled from 'styled-components';

import { Grid } from '../../LibraryGrid/LibraryGrid.styles';

/**
 * The first load, laid out on the grid it is about to become. It reuses
 * `LibraryGrid`'s own `Grid` rather than restating the track sizing, so the
 * placeholders sit exactly where the posters will land and nothing shifts under
 * the eye when they do.
 */
export const SkeletonGrid = styled(Grid)``;
