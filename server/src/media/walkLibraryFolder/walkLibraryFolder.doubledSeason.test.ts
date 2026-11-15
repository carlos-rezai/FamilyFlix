// @vitest-environment node
//
// 64, Rescan a folder, Phase 3 (issue #620): the doubled season.
//
// Two **Season folders** of one number are a **Doubled place**, worded as
// every other: `⚠ Death Note holds 2 Season 1 folders, Season 01 read`. One
// Season folder per number raises no such line.
//
// Against a real tree under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { walkLibraryFolder } from './walkLibraryFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A fresh Library folder holding the files at the relative paths given. */
function libraryWith(files: string[]): string {
  const root = join(sandboxRoot('familyflix-walk-doubled-season-'), 'Shows');
  mkdirSync(root);
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return root;
}

describe('walkLibraryFolder: a doubled season', () => {
  it('words two Season folders of one number as a Doubled place line', async () => {
    const root = libraryWith([
      'Death Note/Season 1/Death.Note.S01E01.mkv',
      'Death Note/Season 01/Death.Note.S01E01.Rebirth.mkv',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(walk.warnings).toContain(
      '⚠ Death Note holds 2 Season 1 folders, Season 01 read'
    );
  });

  it('raises no such line for a show with one Season folder per number', async () => {
    const root = libraryWith([
      'Death Note/Season 1/Death.Note.S01E01.mkv',
      'Death Note/Season 01/Death.Note.S01E01.Rebirth.mkv',
      'Tidewater (2018)/Season 1/Tidewater.S01E01.mp4',
      'Tidewater (2018)/Season 02/Tidewater.S02E01.mp4',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(
      walk.warnings.filter((line) => /Season \d+ folders/.test(line))
    ).toEqual(['⚠ Death Note holds 2 Season 1 folders, Season 01 read']);
  });
});
