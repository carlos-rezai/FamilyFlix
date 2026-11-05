// @vitest-environment node
//
// Issue #520 — the **Menu entry**. Run as an **AppImage** (Linux with
// `$APPIMAGE` set), FamilyFlix writes its own `FamilyFlix.desktop` and copies
// the **App mark** into the hicolor theme, so KWin, which takes the window's
// icon from an entry named exactly after the app id, gives the window, the
// taskbar and the menu the mark. `menuEntry` decides the two files; the
// writer puts them on disk through an injected file system, as the **Shell
// log**'s `LogFileSystem` does, only where the file differs, and deletes
// nothing. A failure is one Shell log line; the launch goes on.

import { describe, expect, it, vi } from 'vitest';

import {
  menuEntry,
  writeMenuEntry,
  type MenuEntryFileSystem,
  type MenuEntryFiles,
} from './menuEntry';

const HOME = '/home/deck';
const APPIMAGE = '/home/deck/Applications/FamilyFlix-x86_64.AppImage';
const SYNOPSIS = 'The family movie folder, as a browsable library';

const ENTRY_PATH = '/home/deck/.local/share/applications/FamilyFlix.desktop';
const ICON_PATH =
  '/home/deck/.local/share/icons/hicolor/512x512/apps/familyflix.png';
const MARK_PATH =
  '/tmp/.mount_Family/resources/app.asar/electron/assets/icon.png';
const MARK = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const linux = (appImage: string | undefined = APPIMAGE) =>
  menuEntry({ platform: 'linux', appImage, home: HOME }, SYNOPSIS);

/** The entry's `[Desktop Entry]` header and its keys, as a map. */
function parse(text: string): { header: string; keys: Record<string, string> } {
  const [header = '', ...rest] = text.split('\n').filter((l) => l.length > 0);
  const keys: Record<string, string> = {};
  for (const line of rest) {
    const at = line.indexOf('=');
    keys[line.slice(0, at)] = line.slice(at + 1);
  }
  return { header, keys };
}

describe('menuEntry — when there is one', () => {
  it('answers null on Windows, even with $APPIMAGE set', () => {
    expect(
      menuEntry(
        { platform: 'win32', appImage: APPIMAGE, home: 'C:\\Users\\family' },
        SYNOPSIS
      )
    ).toBeNull();
  });

  it('answers null on Linux with no $APPIMAGE: an Unpackaged run or an extracted AppImage', () => {
    expect(
      menuEntry(
        { platform: 'linux', appImage: undefined, home: HOME },
        SYNOPSIS
      )
    ).toBeNull();
  });
});

describe('menuEntry — the files', () => {
  it('names FamilyFlix.desktop and familyflix.png under the home folder', () => {
    const files = linux();

    expect(files?.entryPath).toBe(ENTRY_PATH);
    expect(files?.iconPath).toBe(ICON_PATH);
  });

  it('writes the entry the log decided', () => {
    const { header, keys } = parse(linux()?.entryText ?? '');

    expect(header).toBe('[Desktop Entry]');
    expect(keys).toEqual({
      Type: 'Application',
      Name: 'FamilyFlix',
      Comment: SYNOPSIS,
      Exec: `"${APPIMAGE}" %U`,
      TryExec: APPIMAGE,
      Icon: 'familyflix',
      StartupWMClass: 'FamilyFlix',
      Categories: 'AudioVideo;',
      Terminal: 'false',
    });
  });

  it('quotes an AppImage path with a space in Exec, and never adds --no-sandbox', () => {
    const spaced = '/home/deck/My Apps/FamilyFlix-x86_64.AppImage';
    const text = linux(spaced)?.entryText ?? '';

    expect(parse(text).keys.Exec).toBe(`"${spaced}" %U`);
    expect(text).not.toMatch(/--no-sandbox/);
  });
});

/** An in-memory disk that records every call; it has no way to delete. */
class MemoryFs implements MenuEntryFileSystem {
  readonly files = new Map<string, Buffer>();
  readonly dirs = new Set<string>();
  readonly writes: string[] = [];
  readonly mkdirs: string[] = [];

  read(path: string): Buffer | undefined {
    return this.files.get(path);
  }

  write(path: string, data: Buffer | string): void {
    this.writes.push(path);
    this.files.set(path, Buffer.from(data));
  }

  mkdir(dir: string): void {
    this.mkdirs.push(dir);
    this.dirs.add(dir);
  }
}

const FILES: MenuEntryFiles = {
  entryPath: ENTRY_PATH,
  entryText: '[Desktop Entry]\nName=FamilyFlix\n',
  iconPath: ICON_PATH,
};

/** A disk holding the App mark in the asar, and whatever else is given. */
function disk(extra: Record<string, Buffer | string> = {}): MemoryFs {
  const fs = new MemoryFs();
  fs.files.set(MARK_PATH, MARK);
  for (const [path, data] of Object.entries(extra)) {
    fs.files.set(path, Buffer.from(data));
  }
  return fs;
}

const write = (fs: MenuEntryFileSystem, log = vi.fn()) => {
  writeMenuEntry({ files: FILES, markPath: MARK_PATH, fs, log });
  return log;
};

describe('writeMenuEntry — only where the file differs', () => {
  it('writes nothing when the entry and the icon already match', () => {
    const fs = disk({ [ENTRY_PATH]: FILES.entryText, [ICON_PATH]: MARK });

    const log = write(fs);

    expect(fs.writes).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });

  it('rewrites a differing entry, leaving a matching icon alone', () => {
    const fs = disk({
      [ENTRY_PATH]: '[Desktop Entry]\nExec=AppRun --no-sandbox %U\n',
      [ICON_PATH]: MARK,
    });

    write(fs);

    expect(fs.writes).toEqual([ENTRY_PATH]);
    expect(fs.files.get(ENTRY_PATH)?.toString('utf8')).toBe(FILES.entryText);
  });

  it('rewrites a differing icon with the App mark, leaving a matching entry alone', () => {
    const fs = disk({
      [ENTRY_PATH]: FILES.entryText,
      [ICON_PATH]: Buffer.from([0, 0, 0]),
    });

    write(fs);

    expect(fs.writes).toEqual([ICON_PATH]);
    expect(fs.files.get(ICON_PATH)?.equals(MARK)).toBe(true);
  });

  it('makes the missing folders and writes both files on a first launch', () => {
    const fs = disk();

    write(fs);

    expect(fs.dirs).toEqual(
      new Set([
        '/home/deck/.local/share/applications',
        '/home/deck/.local/share/icons/hicolor/512x512/apps',
      ])
    );
    expect([...fs.writes].sort()).toEqual([ENTRY_PATH, ICON_PATH].sort());
    expect(fs.files.get(ENTRY_PATH)?.toString('utf8')).toBe(FILES.entryText);
    expect(fs.files.get(ICON_PATH)?.equals(MARK)).toBe(true);
  });

  it('never deletes: every other file stays as it was', () => {
    const other =
      '/home/deck/.local/share/applications/appimagekit_ab-FamilyFlix.desktop';
    const fs = disk({ [other]: 'Exec=AppRun --no-sandbox %U\n' });

    write(fs);

    expect(fs.files.get(other)?.toString('utf8')).toBe(
      'Exec=AppRun --no-sandbox %U\n'
    );
    expect(fs.files.get(MARK_PATH)?.equals(MARK)).toBe(true);
    expect([...fs.writes].sort()).toEqual([ENTRY_PATH, ICON_PATH].sort());
  });
});

describe('writeMenuEntry — a failure', () => {
  it('is one Shell log line, and the launch goes on', () => {
    const fs = disk();
    fs.write = () => {
      throw new Error('EACCES: permission denied');
    };
    const log = vi.fn();

    expect(() => write(fs, log)).not.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(/EACCES/);
  });

  it('is one Shell log line when the App mark cannot be read', () => {
    const fs = new MemoryFs();
    fs.read = (path) => {
      if (path === MARK_PATH) throw new Error('ENOENT: no such file');
      return undefined;
    };
    const log = vi.fn();

    expect(() => write(fs, log)).not.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(/ENOENT/);
  });
});
