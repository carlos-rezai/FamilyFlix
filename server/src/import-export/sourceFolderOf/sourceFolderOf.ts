import { relative, sep } from 'node:path';

/**
 * A folder's **Source folder**: `dir` relative to its **Library folder**
 * `root`, with forward slashes whatever the platform spells, as a
 * **Source file** already is. The one spelling every site records and looks
 * one up with.
 */
export const sourceFolderOf = (root: string, dir: string): string =>
  relative(root, dir).split(sep).join('/');
