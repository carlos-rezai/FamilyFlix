import { range } from '@/utils';
import type { FormKind } from '@/types';

// The frame is the real form's own, imported rather than copied: the reason
// `LoadingDetail` gives, a skeleton that traced its own columns would be free
// to drift out of alignment with the screen it is standing in for.
import { Fields, FieldRow, NarrowField } from '../MovieForm/MovieForm.styles';
import { Card } from '../filesCard.styles';
import {
  Root,
  SkeletonHeading,
  SkeletonLede,
  SkeletonField,
  SkeletonArea,
  SkeletonCaption,
  SkeletonSlot,
} from './LoadingForm.styles';

/**
 * The two-field rows above the Description: title and year, credit and
 * cast.
 */
const FIELD_ROWS = 2;

/** The File slots the card holds while the record reads. */
const FILE_SLOTS = 2;

/** What the status is named, by the job's **Form kind**. */
const LABEL: Record<FormKind, string> = {
  movie: 'Loading movie',
  series: 'Loading series',
};

export interface LoadingFormProps {
  /** The job's **Form kind**, which names the wait. */
  kind: FormKind;
}

/**
 * The **Form skeleton**: the **Movie form**'s own frame in **Skeleton**
 * blocks, held while a job naming a record reads it: a heading, the fields
 * and the Files card, and no save, so nothing is added twice or typed over.
 * `LoadingDetail` and `LoadingSeries` are its precedent: it announces itself
 * once, as a status named by the kind, and the blocks inside it are hidden
 * from assistive technology.
 */
export function LoadingForm({ kind }: LoadingFormProps) {
  return (
    <Root role="status" aria-label={LABEL[kind]}>
      <SkeletonHeading />
      <SkeletonLede />
      <Fields aria-hidden="true">
        {range(FIELD_ROWS).map((row) => (
          <FieldRow key={row}>
            <SkeletonField />
            {row === 0 ? (
              <NarrowField as="div">
                <SkeletonField />
              </NarrowField>
            ) : (
              <SkeletonField />
            )}
          </FieldRow>
        ))}
        <SkeletonArea />
        <Card>
          <SkeletonCaption />
          {range(FILE_SLOTS).map((slot) => (
            <SkeletonSlot key={slot} />
          ))}
        </Card>
      </Fields>
    </Root>
  );
}
