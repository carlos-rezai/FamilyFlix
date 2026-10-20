/**
 * Main's half of the **Shell trash**, over an injected world — the
 * `openMediaFolder` shape: Node's `existsSync` and Electron's
 * `shell.trashItem`.
 */
export interface TrashWorld {
  exists(path: string): boolean;
  /** `shell.trashItem`: resolves once the path is in the Recycle Bin. */
  trashItem(path: string): Promise<void>;
}

/**
 * Move each path to the Recycle Bin, in order. A path already gone counts as
 * gone; the first the bin will not take stops the rest and is answered —
 * else `null`, the `failed` of the `trashed` command main posts back.
 */
export async function trashItems(
  paths: readonly string[],
  world: TrashWorld
): Promise<string | null> {
  for (const path of paths) {
    if (!world.exists(path)) continue;
    try {
      await world.trashItem(path);
    } catch {
      return path;
    }
  }
  return null;
}
