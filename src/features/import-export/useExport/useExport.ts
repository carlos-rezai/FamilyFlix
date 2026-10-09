import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExportFormat, ExportResult, ExportSummary } from '@/types';
import { fetchExportSummary, startExport } from '../api/api';

export interface ExportState {
  /** The chosen **Export format** — `csv` on every open. */
  format: ExportFormat;
  /**
   * The **Export summary**: `null` until it lands, and `null` still if it
   * never does. It fills _Save to_ and the name row, and never blocks the
   * export.
   */
  summary: ExportSummary | null;
  /** What _Save to_ holds — the summary's default until something is typed. */
  destination: string;
  /** True for the life of the export request, false before and after. */
  exporting: boolean;
  /** Whether images travel beside the sheet — the _Images_ toggle, on every open. */
  images: boolean;
  /** The sentence a `400` said about the destination; `null` otherwise. */
  refusal: string | null;
  /** What a `201` answered — **Export ready**; `null` until then. */
  result: ExportResult | null;
  chooseFormat: (format: ExportFormat) => void;
  /** Take what was typed into _Save to_; the default never writes over it. */
  setDestination: (destination: string) => void;
  /** Turn the _Images_ toggle on or off. */
  setImages: (images: boolean) => void;
  /**
   * Ask the server to write the export into _Save to_. A `201` sets `result`,
   * a `400` sets `refusal` and keeps the idle face, and any other failure
   * leaves the dialog as it was — so this resolves rather than rejects.
   */
  exportLibrary: () => Promise<void>;
}

/**
 * What the **Export dialog** holds, from the moment it opens: the format, the
 * summary, the destination, and whether a request is in flight, was refused or
 * has written the **Export folder**.
 *
 * `open` is the reset: each opening puts the hook back to `csv`, images on, idle, nothing
 * typed, refused or written, and fetches a fresh summary. The summary's
 * `defaultDestination` fills _Save to_ once it lands, but never over a path
 * typed first — `useTmdbKey`'s rule. A summary or an export that lands after
 * the dialog has closed — or after it has been opened again — redraws
 * nothing. The export itself still happens: a close drops the **Export
 * ready** face, not the folder.
 */
export function useExport(open: boolean): ExportState {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [destination, setTyped] = useState('');
  const [images, setImages] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  // Which opening is current. Bumped as each opening ends — on close, and on
  // unmount — so an answer that arrives for an earlier opening can tell it is
  // no longer wanted.
  const opening = useRef(0);
  // Whether _Save to_ has been typed into this opening.
  const typed = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const current = opening.current;

    typed.current = false;
    setFormat('csv');
    setSummary(null);
    setTyped('');
    setImages(true);
    setExporting(false);
    setRefusal(null);
    setResult(null);

    fetchExportSummary().then(
      (landed) => {
        if (opening.current !== current) {
          return;
        }
        setSummary(landed);
        if (!typed.current) {
          setTyped(landed.defaultDestination);
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

  const setDestination = useCallback((next: string) => {
    typed.current = true;
    setTyped(next);
  }, []);

  const exportLibrary = useCallback(async () => {
    const current = opening.current;
    setExporting(true);
    try {
      const outcome = await startExport({
        format,
        destination,
        images,
        subtitles: false,
      });
      if (opening.current !== current) {
        return;
      }
      if (outcome.kind === 'written') {
        setRefusal(null);
        setResult(outcome.result);
      } else {
        setRefusal(outcome.sentence);
      }
    } catch {
      // Any other failure leaves the dialog as it was: the button comes back.
    } finally {
      if (opening.current === current) {
        setExporting(false);
      }
    }
  }, [format, destination, images]);

  return {
    format,
    summary,
    destination,
    images,
    exporting,
    refusal,
    result,
    chooseFormat,
    setDestination,
    setImages,
    exportLibrary,
  };
}
