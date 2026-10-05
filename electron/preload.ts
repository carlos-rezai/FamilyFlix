import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import {
  UPDATE_CHANNELS,
  type UpdateBridge,
  type UpdateCheck,
  type UpdateStatus,
} from '../src/types/update';

/**
 * The **Desktop shell**'s preload: wiring only. It defines
 * `window.familyflix.updates`, each member passing one channel through to
 * main and holding no state. `sandbox`, `contextIsolation` and
 * `nodeIntegration: false` are untouched — `contextBridge` is the one way
 * across. See `docs/PRDs/17-software-update.md`, _The preload_.
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

contextBridge.exposeInMainWorld('familyflix', { updates });
