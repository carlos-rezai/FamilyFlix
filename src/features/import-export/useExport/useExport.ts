import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  ExportField,
  ExportFormat,
  ExportResult,
  ExportSummary,
} from '@/types';
import { fetchExportSummary, startExport } from '../api/api';
import { folderBridge } from '@/api/folderBridge/folderBridge';

/** A `400`'s sentence and the field it is drawn under. */
export interface ExportRefusal {
  field: ExportField;
  sentence: string;
}

export interface ExportState {
  /** The chosen **Export format** — `csv` on every open. */
  format: ExportFormat;
  /**
   * The **Export summary**: `null` until it lands, and `null` still if it
   * never does. It fills _Save to_, the **Folder name field** and its count,
   * and never blocks the export.
   */
  summary: ExportSummary | null;
  /** What _Save to_ holds — the summary's default until something is typed. */
  destination: string;
  /**
   * What the **Folder name field** holds — the summary's `defaultName` until
   * something is typed, and posted exactly as it stands.
   */
  name: string;
  /** True for the life of the export request, false before and after. */
  exporting: boolean;
  /**
   * Whether images travel beside the sheet — the _Images_ toggle, on every
   * open.
   */
  images: boolean;
  /**
   * Whether subtitle files travel too — the _Subtitles_ toggle, off on every
   * open.
   */
  subtitles: boolean;
  /**
   * What the last press's `400` said and which field it is about; `null`
   * otherwise. Kept until the next press.
   */
  refusal: ExportRefusal | null;
  /** What a `201` answered — **Export ready**; `null` until then. */
  result: ExportResult | null;
  chooseFormat: (format: ExportFormat) => void;
  /** Take what was typed into _Save to_; the default never writes over it. */
  setDestination: (destination: string) => void;
  /** Take what was typed into the name; the default never writes over it. */
  setName: (name: string) => void;
  /**
   * _Browse…_: the native one-folder dialog, writing the folder picked into
   * _Save to_ and leaving it as it was on a cancel. `null` in a browser,
   * where there is no folder bridge — and no button.
   */
  browse: (() => Promise<void>) | null;
  /** Turn the _Images_ toggle on or off. */
  setImages: (images: boolean) => void;
  /** Turn the _Subtitles_ toggle on or off. */
  setSubtitles: (subtitles: boolean) => void;
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
 * `open` is the reset: each opening puts the hook back to `csv`, images on,
 * subtitles off, idle, nothing typed, refused or written, and fetches a fresh
 * summary. The summary's `defaultDestination` fills _Save to_ and its
 * `defaultName` the name once it lands, each never over what was typed into
 * it first — `useTmdbKey`'s rule. A summary or an
 * export that lands after the dialog has closed — or after it has been opened
 * again — redraws nothing. The export itself still happens: a close drops the
 * **Export ready** face, not the folder.
 */
export function useExport(open: boolean): ExportState {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [destination, setField] = useState('');
  const [name, setNameField] = useState('');
  const [images, setImages] = useState(true);
  const [subtitles, setSubtitles] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refusal, setRefusal] = useState<ExportRefusal | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  // Which opening is current. Bumped as each opening ends — on close, and on
  // unmount — so an answer that arrives for an earlier opening can tell it is
  // no longer wanted.
  const opening = useRef(0);
  // Whether _Save to_, and the name, have been edited in this opening.
  const destinationEdited = useRef(false);
  const nameEdited = useRef(false);
  // The folder bridge, read once per mount: `null` in a browser.
  const [bridge] = useState(folderBridge);

  useEffect(() => {
    if (!open) {
      return;
    }
    const current = opening.current;

    destinationEdited.current = false;
    nameEdited.current = false;
    setFormat('csv');
    setSummary(null);
    setField('');
    setNameField('');
    setImages(true);
    setSubtitles(false);
    setExporting(false);
    setRefusal(null);
    setResult(null);

    fetchExportSummary().then(
      (landed) => {
        if (opening.current !== current) {
          return;
        }
        setSummary(landed);
        if (!destinationEdited.current) {
          setField(landed.defaultDestination);
        }
        if (!nameEdited.current) {
          setNameField(landed.defaultName);
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
    destinationEdited.current = true;
    setField(next);
  }, []);

  const setName = useCallback((next: string) => {
    nameEdited.current = true;
    setNameField(next);
  }, []);

  const browse = useMemo(
    () =>
      bridge === null
        ? null
        : async () => {
            const picked = await bridge.pickOne();
            if (picked !== null) {
              setDestination(picked);
            }
          },
    [bridge, setDestination]
  );

  const exportLibrary = useCallback(async () => {
    const current = opening.current;
    setExporting(true);
    try {
      const outcome = await startExport({
        format,
        destination,
        images,
        subtitles,
        name,
      });
      if (opening.current !== current) {
        return;
      }
      if (outcome.kind === 'written') {
        setRefusal(null);
        setResult(outcome.result);
      } else {
        setRefusal({ field: outcome.field, sentence: outcome.sentence });
      }
    } catch {
      // Any other failure leaves the dialog as it was: the button comes back.
    } finally {
      if (opening.current === current) {
        setExporting(false);
      }
    }
  }, [format, destination, images, subtitles, name]);

  return {
    format,
    summary,
    destination,
    name,
    images,
    subtitles,
    exporting,
    refusal,
    result,
    chooseFormat,
    setDestination,
    setName,
    browse,
    setImages,
    setSubtitles,
    exportLibrary,
  };
}
