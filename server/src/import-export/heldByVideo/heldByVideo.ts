import type { HeldTitle, StoredLibraryFolder } from '../../library';
import { spellLinkedVideo } from '../../playback/linkedVideoPath/linkedVideoPath';

/**
 * The **Held video** rule over a list of found videos: the first title of
 * `kind` one of them already belongs to, whatever it is called, each video
 * spelled as a **Linked video** under the listed `folder`; `null` for none.
 * A title of the other kind passes.
 */
export function heldByVideo(
  titleHolding: (folderId: string, videoPath: string) => HeldTitle | null,
  folder: StoredLibraryFolder,
  videos: readonly string[],
  kind: HeldTitle['kind']
): string | null {
  for (const video of videos) {
    const held = titleHolding(folder.id, spellLinkedVideo(folder.path, video));
    if (held !== null && held.kind === kind) {
      return held.id;
    }
  }
  return null;
}
