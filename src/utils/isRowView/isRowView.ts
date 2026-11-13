import { ROW_VIEWS, type RowView } from '@/types';

/**
 * Whether a value is one of the views in {@link ROW_VIEWS}, exactly:
 * `isLibraryTab`'s twin, for the settings routes' echo of a stored **Row
 * view**, which is not known to be a string.
 */
export function isRowView(value: unknown): value is RowView {
  return (
    typeof value === 'string' &&
    (ROW_VIEWS as readonly string[]).includes(value)
  );
}
