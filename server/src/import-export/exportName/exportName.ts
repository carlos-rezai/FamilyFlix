import { EXPORT_NAME_PREFIX } from '@/types';

/** A day or month as two digits. */
const twoDigits = (value: number): string => String(value).padStart(2, '0');

/**
 * The **Export name**: `familyflix-collection_DD-MM-YYYY`, off the local date
 * — the day the maintainer pressed the button on, not the UTC one. The one
 * place the name is spelled; the clock is the caller's.
 */
export function exportName(now: Date): string {
  const day = twoDigits(now.getDate());
  const month = twoDigits(now.getMonth() + 1);
  return `${EXPORT_NAME_PREFIX}_${day}-${month}-${now.getFullYear()}`;
}
