import { useCallback, useEffect, useRef, useState } from 'react';

import { EXPORT_FILENAME, type ExportFormat } from '@/types';
import {
  exportLibrary as fetchExportFile,
  fetchExportSummary,
} from '../api/api';
import { saveToComputer } from '../saveToComputer/saveToComputer';

export interface ExportState {
  /** The chosen **Export format** — `csv` on every open. */
  format: ExportFormat;
  /**
   * The **Export summary**'s count: `null` until it lands, and `null` still
   * if it never does. It is drawn beside the filename and never blocks the
   * export.
   */
  movieCount: number | null;
  /** True for the life of the file request, false before and after. */
  exporting: boolean;
  /** True once the browser has been handed the file — **Export ready**. */
  done: boolean;
  chooseFormat: (format: ExportFormat) => void;
  /**
   * Fetch the chosen format's file, hand it to **Save to computer** under
   * the format's filename, then set `done`. A request the server refuses
   * clears `exporting` and changes nothing else — the refusal is a state the
   * dialog already shows, so this resolves rather than rejects.
   */
  exportLibrary: () => Promise<void>;
}

/**
 * What the **Export dialog** holds, from the moment it opens: the format, the
 * count, and whether a request is in flight or has finished.
 *
 * `open` is the reset: each opening puts the hook back to `csv` and idle and
 * fetches a fresh summary, so a dialog closed on **Export ready** reopens on
 * its idle face with the library's count as it stands now. A summary or an
 * export that lands after the dialog has closed — or after it has been opened
 * again — is dropped, so a stale answer never redraws a newer opening.
 *
 * A refused export is the Delete dialog's rule: the prototype designs no error
 * face, so the button comes back and the format and the count are kept, the
 * dialog still up for a second try.
 */
export function useExport(open: boolean): ExportState {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [movieCount, setMovieCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  // Which opening is current. Bumped as each opening ends — on close, and on
  // unmount — so an answer that arrives for an earlier opening can tell it is
  // no longer wanted.
  const opening = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    const current = opening.current;

    setFormat('csv');
    setMovieCount(null);
    setExporting(false);
    setDone(false);

    fetchExportSummary().then(
      (summary) => {
        if (opening.current === current) {
          setMovieCount(summary.movieCount);
        }
      },
      () => undefined
    );

    return () => {
      opening.current += 1;
    };
  }, [open]);

  const chooseFormat = useCallback((next: ExportFormat) => {
    setFormat(next);
  }, []);

  const exportLibrary = useCallback(async () => {
    const current = opening.current;
    setExporting(true);
    try {
      const blob = await fetchExportFile(format);
      saveToComputer(blob, EXPORT_FILENAME[format]);
      if (opening.current === current) {
        setDone(true);
      }
    } catch {
      // The refusal is a state, not an error: the button comes back below.
    } finally {
      if (opening.current === current) {
        setExporting(false);
      }
    }
  }, [format]);

  return { format, movieCount, exporting, done, chooseFormat, exportLibrary };
}
