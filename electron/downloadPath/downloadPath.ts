import { extname, join } from 'node:path';

/**
 * Where a download lands in `dir`: the file's own name when it is free, and
 * otherwise the first free `name (n).ext`, numbered before the last extension
 * the way Chromium does it. Pure — the disk is the `exists` predicate.
 */
export function downloadPath(
  dir: string,
  filename: string,
  exists: (path: string) => boolean
): string {
  const first = join(dir, filename);
  if (!exists(first)) return first;

  const ext = extname(filename);
  const stem = filename.slice(0, filename.length - ext.length);
  for (let n = 1; ; n += 1) {
    const candidate = join(dir, `${stem} (${n})${ext}`);
    if (!exists(candidate)) return candidate;
  }
}
