// @vitest-environment node
//
// 30 — Library folders, Phase 1 (issue #268).
//
// `readableFolder(path)` — the importer's private `checkRoot`, extracted: is
// this absolute path an existing directory the app can read? Answered as a
// value, never a throw, so the folder add, the spreadsheet import's root check
// and the per-folder `reachable` read can each word the answer their own way.

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { readableFolder } from './readableFolder';

describe('readableFolder', () => {
  it('answers readable for an existing directory', async () => {
    const root = sandboxRoot('familyflix-readable-');
    const folder = join(root, 'Movies');
    mkdirSync(folder);

    await expect(readableFolder(folder)).resolves.toBe('readable');
  });

  it('answers not-a-folder for a file', async () => {
    const root = sandboxRoot('familyflix-readable-');
    const file = join(root, 'northwind.mkv');
    writeFileSync(file, 'not a film');

    await expect(readableFolder(file)).resolves.toBe('not-a-folder');
  });

  it('answers missing for a path nothing is at', async () => {
    const root = sandboxRoot('familyflix-readable-');

    await expect(readableFolder(join(root, 'Gone'))).resolves.toBe('missing');
  });

  it('answers relative for a relative path, without looking', async () => {
    // `.` is a directory wherever the suite runs — so only the shape refuses it.
    await expect(readableFolder('.')).resolves.toBe('relative');
    await expect(readableFolder('Movies\\Kids')).resolves.toBe('relative');
  });
});
