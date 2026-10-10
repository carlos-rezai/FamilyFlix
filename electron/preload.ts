import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  FOLDER_CHANNELS,
  type FolderBridge,
} from '../src/types/libraryFolders';
import {
  UPDATE_CHANNELS,
  type UpdateBridge,
  type UpdateCheck,
  type UpdateStatus,
} from '../src/types/update';

/**
 * The **Desktop shell**'s preload: wiring only. It defines
 * `window.familyflix.updates` and `window.familyflix.folders`, each member
 * passing one channel through to main and holding no state. `sandbox`,
 * `contextIsolation` and `nodeIntegration: false` are untouched —
 * `contextBridge` is the one way across. See
 * `docs/PRDs/17-software-update.md`, _The preload_.
 */
const updates: UpdateBridge = {
  current: () =>
    ipcRenderer.invoke(UPDATE_CHANNELS.current) as Promise<UpdateStatus>,
  onStatus(listener) {
    const forward = (_event: IpcRendererEvent, status: UpdateStatus) =>
      listener(status);
    ipcRenderer.on(UPDATE_CHANNELS.status, forward);
    return () => {
      ipcRenderer.removeListener(UPDATE_CHANNELS.status, forward);
    };
  },
  check: () =>
    ipcRenderer.invoke(UPDATE_CHANNELS.check) as Promise<UpdateCheck>,
  install: () => ipcRenderer.send(UPDATE_CHANNELS.install),
};

/**
 * The native folder pickers: the **Library folders page**'s _Browse…_, and
 * the Export dialog's; and the Storage card's _Open folder_.
 */
const folders: FolderBridge = {
  pick: () => ipcRenderer.invoke(FOLDER_CHANNELS.pick) as Promise<string[]>,
  pickOne: () =>
    ipcRenderer.invoke(FOLDER_CHANNELS.pickOne) as Promise<string | null>,
  openMedia: () =>
    ipcRenderer.invoke(FOLDER_CHANNELS.openMedia) as Promise<void>,
};

contextBridge.exposeInMainWorld('familyflix', { updates, folders });
