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

/**
 * Why Windows would refuse a folder called `name` — checked in this order:
 * `unnamed` (empty or whitespace only), `too-long` (over 200 characters),
 * `bad-character` (`< > : " / \ | ? *` or a control character), `bad-ending`
 * (a trailing space or dot, `.` and `..` among them), `reserved` (a device
 * name before any extension, in any case).
 */
export type ExportNameRefusal =
  | 'unnamed'
  | 'too-long'
  | 'bad-character'
  | 'bad-ending'
  | 'reserved';

/** The longest name an **Export folder** may be given. */
const MAX_NAME = 200;

// eslint-disable-next-line no-control-regex
const BAD_CHARACTER = /[<>:"/\\|?*\u0000-\u001f]/;

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

/**
 * The reader beside {@link exportName}: what Windows would refuse to call a
 * folder, on every platform, or `null` for a name it takes. Nothing is
 * stripped or trimmed — this is the only thing between the typed string and
 * the `join` under the destination, so it answers the name as typed and never
 * relaxes into sanitising.
 */
export function exportNameRefusal(name: string): ExportNameRefusal | null {
  if (name.trim() === '') {
    return 'unnamed';
  }
  if (name.length > MAX_NAME) {
    return 'too-long';
  }
  if (BAD_CHARACTER.test(name)) {
    return 'bad-character';
  }
  if (name.endsWith(' ') || name.endsWith('.')) {
    return 'bad-ending';
  }
  if (RESERVED.test(name)) {
    return 'reserved';
  }
  return null;
}
