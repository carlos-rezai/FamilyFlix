import styled from 'styled-components';

import { Skeleton } from '@/primitives';

/** The status itself: a plain block the frame's pieces stack inside. */
export const Root = styled.div`
  display: block;
`;

/** The heading's place, at the size `PageHeader` draws it. */
export const SkeletonHeading = styled(Skeleton)`
  width: 40%;
  height: 40px;
`;

/** The lede's place, one line under the heading. */
export const SkeletonLede = styled(Skeleton)`
  width: 70%;
  max-width: 560px;
  height: 16px;
  margin: 14px 0 ${({ theme }) => theme.space.s6};
`;

/** A field's 48px box, as `FIELD_BOX` draws every field on the form. */
export const SkeletonField = styled(Skeleton)`
  width: 100%;
  height: 48px;
`;

/** The Description's taller box. */
export const SkeletonArea = styled(Skeleton)`
  width: 100%;
  height: 120px;
`;

/** The Files card's caption. */
export const SkeletonCaption = styled(Skeleton)`
  width: 80px;
  height: 12px;
`;

/** One File slot inside the card. */
export const SkeletonSlot = styled(Skeleton)`
  width: 100%;
  height: 56px;
`;
