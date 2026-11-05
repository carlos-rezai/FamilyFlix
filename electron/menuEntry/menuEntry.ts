import { posix } from 'node:path';

/**
 * The **Menu entry**. Run as an **AppImage** (Linux with `$APPIMAGE` set),
 * FamilyFlix writes its own `FamilyFlix.desktop` and copies the **App mark**
 * into the hicolor theme: KWin takes the window's icon from an entry named
 * exactly after the app id. `menuEntry` decides the two files;
 * `writeMenuEntry` puts them on disk only where the file differs, makes the
 * folders it needs and deletes nothing. See
 * `docs/design-logs/56-linux-build.md`, _the Menu entry_.
 */

export interface MenuEntryFiles {
  /** `~/.local/share/applications/FamilyFlix.desktop` */
  entryPath: string;
  entryText: string;
  /** `~/.local/share/icons/hicolor/512x512/apps/familyflix.png` */
  iconPath: string;
}

export interface MenuEntryEnv {
  platform: NodeJS.Platform;
  /** `$APPIMAGE`: the AppImage's path where it now lies. */
  appImage: string | undefined;
  home: string;
}

export function menuEntry(
  { platform, appImage, home }: MenuEntryEnv,
  synopsis: string
): MenuEntryFiles | null {
  if (platform !== 'linux' || appImage === undefined || appImage === '') {
    return null;
  }

  const share = posix.join(home, '.local', 'share');
  const entryText = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=FamilyFlix',
    `Comment=${synopsis}`,
    `Exec="${appImage}" %U`,
    `TryExec=${appImage}`,
    'Icon=familyflix',
    'StartupWMClass=FamilyFlix',
    'Categories=AudioVideo;',
    'Terminal=false',
    '',
  ].join('\n');

  return {
    entryPath: posix.join(share, 'applications', 'FamilyFlix.desktop'),
    entryText,
    iconPath: posix.join(
      share,
      'icons',
      'hicolor',
      '512x512',
      'apps',
      'familyflix.png'
    ),
  };
}

/** The part of the file system the writer uses, injected. It cannot delete. */
export interface MenuEntryFileSystem {
  /** The file's bytes, or `undefined` when there is none. */
  read(path: string): Buffer | undefined;
  /** Write the file, replacing it when it exists. */
  write(path: string, data: Buffer | string): void;
  /** Make the folder, and its parents, when missing. */
  mkdir(dir: string): void;
}

export interface WriteMenuEntryOptions {
  files: MenuEntryFiles;
  /** The **App mark** inside the app: `electron/assets/icon.png`. */
  markPath: string;
  fs: MenuEntryFileSystem;
  /** One **Shell log** line on a failure. */
  log: (text: string) => void;
}

/** Write `data` to `path` unless the file there already holds it. */
function writeIfDiffers(
  fs: MenuEntryFileSystem,
  path: string,
  data: Buffer
): void {
  const current = fs.read(path);
  if (current !== undefined && current.equals(data)) return;
  fs.mkdir(posix.dirname(path));
  fs.write(path, data);
}

export function writeMenuEntry({
  files,
  markPath,
  fs,
  log,
}: WriteMenuEntryOptions): void {
  try {
    writeIfDiffers(fs, files.entryPath, Buffer.from(files.entryText, 'utf8'));
    const mark = fs.read(markPath);
    if (mark === undefined) {
      throw new Error(`ENOENT: no App mark at ${markPath}`);
    }
    writeIfDiffers(fs, files.iconPath, mark);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(`Menu entry not written: ${reason}`);
  }
}
