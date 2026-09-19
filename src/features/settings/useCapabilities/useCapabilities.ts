import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlaybackCapabilities } from '@/types';
import {
  ComponentRefusedError,
  fetchCapabilities,
  installComponent as postComponent,
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
  /** A write is in flight. `remove` joins `install` when the ✕ ships. */
  | { kind: 'busy'; action: 'install' }
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
}

/** What the zone says when the route refused and named no reason of its own. */
const FALLBACK_REASON = "Couldn't add the playback component.";

/** The sentence to draw for a refusal: the route's own, or the fixed line. */
function reasonFor(refusal: unknown): string {
  return refusal instanceof ComponentRefusedError
    ? refusal.message
    : FALLBACK_REASON;
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
 * Nothing re-fetches after a write: `POST /api/playback/component` answers the
 * report after the swap, and that echo *is* the redraw — a second `GET` would
 * be a second chance to disagree with it.
 *
 * **The write never rejects.** The organism draws a refusal from state and
 * never from a caught exception, so a caller that forgot to `catch` cannot
 * turn a `409` into an unhandled rejection. A call made while one is in flight
 * is ignored — two uploads cannot race into the same slot — and an answer
 * landing after the screen has gone redraws nothing.
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

  const install = useCallback(async (files: File[]): Promise<void> => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setUpload({ kind: 'busy', action: 'install' });

    try {
      const report = await postComponent(files);
      if (onScreen.current) {
        setCapabilities(report);
        setUpload({ kind: 'idle' });
      }
    } catch (refusal) {
      if (onScreen.current) {
        // The report stays exactly as it was: nothing was swapped.
        setUpload({ kind: 'refused', reason: reasonFor(refusal) });
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  return { capabilities, upload, installComponent: install };
}
