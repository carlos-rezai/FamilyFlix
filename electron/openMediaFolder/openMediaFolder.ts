/**
 * Open folder: the Storage card's button, answered in main. Electron's
 * `shell.openPath`, a recursive `mkdir` and the **Shell log** are injected,
 * the way `shellDialogs` takes its world.
 */
export interface MediaFolderWorld {
  /** A recursive `mkdirSync`: a fresh install has no media folder yet. */
  mkdir(path: string): void;
  /** `shell.openPath`: `''` on success, else the error. */
  openPath(path: string): Promise<string>;
  /** The **Shell log**'s `main`. */
  log(text: string): void;
}

const failed = (root: string, error: string) =>
  `Couldn’t open the media folder: ${error} (${root})`;

/**
 * Make the **Managed media directory** if it is absent, then show it in
 * Explorer. Every failure is one Shell log line naming the root; nothing
 * reaches the screen, and it never rejects.
 */
export async function openMediaFolder(
  root: string,
  world: MediaFolderWorld
): Promise<void> {
  try {
    world.mkdir(root);
  } catch (error) {
    world.log(
      failed(root, error instanceof Error ? error.message : String(error))
    );
    return;
  }

  try {
    const error = await world.openPath(root);
    if (error !== '') {
      world.log(failed(root, error));
    }
  } catch (error) {
    world.log(
      failed(root, error instanceof Error ? error.message : String(error))
    );
  }
}
