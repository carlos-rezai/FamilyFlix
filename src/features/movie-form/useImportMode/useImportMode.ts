import { useCallback, useRef, useState } from 'react';

import { folderBridge } from '@/api/folderBridge/folderBridge';
import type { FormKind, ImportMode } from '@/types';
import { containingFolder } from '../api/api';

export interface UseImportModeResult {
  /**
   * Whether the **Import mode** is drawn: on a plain add of either kind in the
   * shell, and only there — never on an edit, a Resolve or in a browser.
   */
  showImportMode: boolean;
  /**
   * The mode a save sends: the one chosen — Link on every visit — or Copy
   * while Link can't be, and always Copy where the choice is not drawn.
   */
  importMode: ImportMode;
  /** Choose a mode; a press on the disabled Link changes nothing. */
  setImportMode: (mode: ImportMode) => void;
  /**
   * Whether Link can't be chosen for the kind on screen: the picked **Show
   * folder**, or the movie's picked video, lies under no **Library folder**.
   */
  linkDisabled: boolean;
  /** The movie's picked video's path, as the **Path bridge** read it, or `''`. */
  videoPath: string;
  /**
   * Whether the containing read answered that the movie's picked video lies
   * under a **Library folder**: on a **Resolve**, the pick then travels as its
   * path, a **Found file**, which the run's own Import mode places.
   */
  videoUnderFolder: boolean;
  /**
   * A movie video was picked: on a shell add or Resolve, read its path through
   * the Path bridge and ask the containing read whether it lies under a
   * Library folder. A later pick's answer wins.
   */
  readVideo: (file: File) => void;
  /** The movie's video slot was emptied: its path and its answer go. */
  forgetVideo: () => void;
  /** Whether Link can be for the series' picked Show folder. */
  setShowLink: (available: boolean) => void;
}

/**
 * The **Import mode** of the **Movie form**'s add, a hook of its own on
 * `useEpisodeList`'s pattern: Link on every visit, never remembered. Each kind
 * answers for its own files, held apart — the series by its Show folder read's
 * Library folder, the movie by the containing read of its video's path — and
 * while the kind on screen can't link, Copy stands chosen until a later answer
 * says Link can be again. A browser has no path to link, so it sends Copy.
 * On a **Resolve** in the shell the movie's pick is read the same way but no
 * mode is drawn: under a Library folder it travels as a **Found file**, which
 * the run's own Import mode places; under none it is uploaded and copied.
 */
export function useImportMode({
  kind,
  plainAdd,
  resolve = false,
}: {
  kind: FormKind;
  plainAdd: boolean;
  /** The form is a **Resolve**: its pick is read, but no mode is drawn. */
  resolve?: boolean;
}): UseImportModeResult {
  const showImportMode = folderBridge() !== null && plainAdd;
  const [chosen, setChosen] = useState<ImportMode>('link');
  const [showLinkDisabled, setShowLinkDisabled] = useState(false);
  const [videoLinkDisabled, setVideoLinkDisabled] = useState(false);
  const [videoPath, setVideoPath] = useState('');
  const [videoUnderFolder, setVideoUnderFolder] = useState(false);
  // Counts the movie's picks, so a containing answer that lands after a later
  // pick, or after the slot was emptied, changes nothing.
  const videoPick = useRef(0);

  const linkDisabled = kind === 'series' ? showLinkDisabled : videoLinkDisabled;
  const importMode: ImportMode =
    !showImportMode || linkDisabled ? 'copy' : chosen;

  const setImportMode = useCallback(
    (mode: ImportMode) => {
      if (mode === 'link' && linkDisabled) {
        return;
      }
      setChosen(mode);
    },
    [linkDisabled]
  );

  const readVideo = useCallback(
    (file: File) => {
      const shell = folderBridge();
      if (shell === null || !(plainAdd || resolve)) {
        return;
      }
      const pick = ++videoPick.current;
      const path = shell.pathOf(file);
      setVideoPath(path);
      setVideoUnderFolder(false);
      if (path === '') {
        setVideoLinkDisabled(true);
        return;
      }
      setVideoLinkDisabled(false);
      void containingFolder(path)
        .then((folderId) => {
          if (pick === videoPick.current) {
            setVideoLinkDisabled(folderId === null);
            setVideoUnderFolder(folderId !== null);
          }
        })
        .catch(() => undefined);
    },
    [plainAdd, resolve]
  );

  const forgetVideo = useCallback(() => {
    videoPick.current += 1;
    setVideoPath('');
    setVideoUnderFolder(false);
    setVideoLinkDisabled(false);
  }, []);

  const setShowLink = useCallback((available: boolean) => {
    setShowLinkDisabled(!available);
  }, []);

  return {
    showImportMode,
    importMode,
    setImportMode,
    linkDisabled,
    videoPath,
    videoUnderFolder,
    readVideo,
    forgetVideo,
    setShowLink,
  };
}
