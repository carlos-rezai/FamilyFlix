import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlaybackCapabilities } from '@/types';
import {
  ComponentRefusedError,
  fetchCapabilities,
  installComponent as postComponent,
  removeComponent as deleteComponent,
} from '../api/api';

/**
 * The **Upload state**: what the **Component drop zone** is doing, as the one
 * thing the zone draws its face from.
 *
 * _Replaced_ is not one of them — the rows, the summary and the **Component
 * row**'s pill changing is the whole of the feedback, and a success flash
 * would be a fourth state saying what the third already showed.
 */
export type UploadState =
  | { kind: 'idle' }
  /** A write is in flight, and which of the two the zone says it is. */
  | { kind: 'busy'; action: 'install' | 'remove' }
  | { kind: 'refused'; reason: string };

export interface CapabilitiesState {
  /**
   * The **Codec report**: `null` until the read lands, the payload after,
   * and `null` still if it never does.
   */
  capabilities: PlaybackCapabilities | null;
  /** What the zone is doing, and what it draws. */
  upload: UploadState;
  /** Install the two **Component binaries** as they were dropped or picked. */
  installComponent: (files: File[]) => Promise<void>;
  /**
   * Take the uploaded pair back out, the **Default component** coming back
   * underneath it. **Nothing is confirmed**: the ✕ removes immediately.
   */
  removeComponent: () => Promise<void>;
}

/**
 * What the zone says when the route refused and named no reason of its own —
 * one line per write, because a `500` is not silence and it is not the wrong
 * sentence either.
 */
const FALLBACK_REASON: Record<'install' | 'remove', string> = {
  install: "Couldn't add the playback component.",
  remove: "Couldn't remove the playback component.",
};

/** The sentence to draw for a refusal: the route's own, or the fixed line. */
function reasonFor(refusal: unknown, action: 'install' | 'remove'): string {
  return refusal instanceof ComponentRefusedError
    ? refusal.message
    : FALLBACK_REASON[action];
}

/**
 * The **Codec report** the `CodecManager` draws, and the one write that
 * changes it — the read and the write in one hook, on the `useSettings`
 * precedent, so the state the write echoes is the state the read holds.
 *
 * **Blank until it lands** — the Export summary's rule, and the shape every
 * read on the Settings page repeats: no skeleton, no error face, no snackbar.
 * A refused read is a report that never arrived.
 *
 * Nothing re-fetches after a write: both halves of `/api/playback/component`
 * answer the report after the write, and that echo *is* the redraw — a second
 * `GET` would be a second chance to disagree with it. **No confirmation** is
 * asked before a remove either: the action is reversible by a drop, and the
 * **Default component** comes back underneath.
 *
 * **The writes never reject.** The organism draws a refusal from state and
 * never from a caught exception, so a caller that forgot to `catch` cannot
 * turn a `409` into an unhandled rejection. A call made while one is in flight
 * is ignored — one slot, one write at a time — and an answer landing after the
 * screen has gone redraws nothing.
 */
export function useCapabilities(): CapabilitiesState {
  const [capabilities, setCapabilities] = useState<PlaybackCapabilities | null>(
    null
  );
  const [upload, setUpload] = useState<UploadState>({ kind: 'idle' });
  const onScreen = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    onScreen.current = true;
    return () => {
      onScreen.current = false;
    };
  }, []);

  useEffect(() => {
    let wanted = true;

    fetchCapabilities().then(
      (report) => {
        if (wanted) {
          setCapabilities(report);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, []);

  /**
   * The one shape both writes have: busy, then the echoed report or the
   * reason it was refused — and never a rejection out of the hook. Only the
   * action and the request itself differ, which is the whole of why there is
   * one of these rather than two.
   */
  const write = useCallback(
    async (
      action: 'install' | 'remove',
      request: () => Promise<PlaybackCapabilities>
    ): Promise<void> => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setUpload({ kind: 'busy', action });

      try {
        const report = await request();
        if (onScreen.current) {
          setCapabilities(report);
          setUpload({ kind: 'idle' });
        }
      } catch (refusal) {
        if (onScreen.current) {
          // The report stays exactly as it was: nothing was swapped or taken.
          setUpload({ kind: 'refused', reason: reasonFor(refusal, action) });
        }
      } finally {
        inFlight.current = false;
      }
    },
    []
  );

  const install = useCallback(
    (files: File[]): Promise<void> =>
      write('install', () => postComponent(files)),
    [write]
  );

  const remove = useCallback(
    (): Promise<void> => write('remove', deleteComponent),
    [write]
  );

  return {
    capabilities,
    upload,
    installComponent: install,
    removeComponent: remove,
  };
}
