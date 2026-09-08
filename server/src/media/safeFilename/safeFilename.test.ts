// @vitest-environment node
//
// 11 — Movie form, Phase 3: "the media domain" (issue #102).
//
// The other half of the dangerous logic, and the one a hostile client aims at:
// the filename travelling in a multipart part is a **client-supplied string**,
// and the only thing between it and a write is this function.
//
// It is pure for that reason. The cases that matter — a name carrying
// separators, a name that is `..`, a name that is only dots, a name that is
// only an extension — are a table of strings here, and awkward to stage over
// HTTP one at a time.
//
// **The guarantee is stated on the joined path, not on the string.** A check
// that refused the substring `..` would still let `a/b.mp4` write into a
// subdirectory nobody asked for; what this has to promise is that
// `join(folder, safeFilename(name))` is a file *directly inside* `folder`,
// whatever the name was.

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';

import { safeFilename } from './safeFilename';

/** Names a crafted client could put in a part's `filename`. */
const CRAFTED = [
  '../../etc/passwd',
  '..',
  '.',
  '...',
  '../rear.mp4',
  '..\\..\\windows\\system32\\evil.dll',
  'a/b/c.mp4',
  'a\\b\\c.mp4',
  '/rear.mp4',
  '\\rear.mp4',
  'C:\\films\\rear.mp4',
  '',
  '   ',
  '.srt',
];

/** The **Movie folder** a stored file has to end up directly inside. */
const FOLDER = resolve('/media/the-lantern-keeper-2019');

describe('safeFilename — an ordinary name', () => {
  it('keeps the name the maintainer picked, extension and all', () => {
    // The **Stored path** is what the maintainer sees when they open the
    // managed directory by hand, so a name that is already safe is left alone
    // rather than slugged into something they would not recognise.
    expect(safeFilename('Rear Window.mp4')).toBe('Rear Window.mp4');
  });

  it('keeps an accented name readable', () => {
    expect(safeFilename('Amélie.mkv')).toBe('Amélie.mkv');
  });

  it('keeps the dots inside a name that has several', () => {
    expect(safeFilename('rear.window.1954.mp4')).toBe('rear.window.1954.mp4');
  });
});

describe('safeFilename — a name carrying a path', () => {
  it('keeps only the last segment of a POSIX path', () => {
    expect(safeFilename('a/b/rear.mp4')).toBe('rear.mp4');
  });

  it('keeps only the last segment of a Windows path', () => {
    // Both separators are stripped whatever this server is running on: the
    // name came off a browser on someone else's machine, not off this disk.
    expect(safeFilename('a\\b\\rear.mp4')).toBe('rear.mp4');
  });

  it('keeps only the last segment of a walk out of the folder', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
  });

  it('drops a drive letter with the rest of the path', () => {
    expect(safeFilename('C:\\films\\rear.mp4')).toBe('rear.mp4');
  });

  it.each(CRAFTED)('answers with no separator at all for %j', (name) => {
    const safe = safeFilename(name);

    expect(safe).not.toContain('/');
    expect(safe).not.toContain('\\');
  });
});

describe('safeFilename — a name that is nothing but dots', () => {
  it('answers with a name rather than the folder above', () => {
    // `..` is the whole attack in two characters: joined to a folder it *is*
    // the folder above it, and a write there is a write outside the movie.
    expect(safeFilename('..')).toBe('file');
  });

  it('answers with a name rather than the folder itself', () => {
    expect(safeFilename('.')).toBe('file');
  });

  it('answers with a name for any number of dots', () => {
    expect(safeFilename('...')).toBe('file');
  });

  it('gives a name that is only an extension something to go in front of it', () => {
    // `.srt` is a hidden file on every POSIX machine and no name at all on
    // Windows. The extension is the half worth keeping.
    expect(safeFilename('.srt')).toBe('file.srt');
  });

  it('answers with a name for a filename that was never sent', () => {
    expect(safeFilename('')).toBe('file');
  });

  it('answers with a name for one that is only whitespace', () => {
    expect(safeFilename('   ')).toBe('file');
  });

  it.each(CRAFTED)('is never dots-only itself for %j', (name) => {
    expect(safeFilename(name)).not.toMatch(/^\.+$/);
  });
});

describe('safeFilename — the guarantee', () => {
  it.each(CRAFTED)('stays directly inside the movie folder for %j', (name) => {
    const written = resolve(FOLDER, safeFilename(name));

    // The whole of what this function is for, stated on the resolved path the
    // way `mediaFilePath` states its own rule: not "the string looks safe" but
    // "the file lands in this folder and nowhere else".
    expect(dirname(written)).toBe(FOLDER);
  });

  it.each(CRAFTED)('never answers with the empty string for %j', (name) => {
    expect(safeFilename(name)).not.toBe('');
  });

  it('strips a null byte rather than passing it to the filesystem', () => {
    // Node refuses a path containing one by throwing, which would turn a
    // crafted name into a failed save rather than a stored file.
    expect(safeFilename('re\0ar.mp4')).not.toContain('\0');
  });
});
