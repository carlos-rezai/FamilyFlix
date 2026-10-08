import type { FolderBridge } from './libraryFolders';
import type { UpdateBridge } from './update';

/**
 * `window.familyflix`, the global the **Desktop shell**'s preload defines.
 * Optional, because a browser — `npm run dev` — has none; read only through
 * `features/software-update/updateBridge` and
 * `features/import-export/folderBridge`. The `appVersion.d.ts` precedent.
 */
declare global {
  interface Window {
    familyflix?: { updates: UpdateBridge; folders: FolderBridge };
  }
}

export {};
