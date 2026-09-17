import { useId } from 'react';

import { Modal } from '@/components';
import { Button, CheckIcon, DownloadIcon, SheetIcon } from '@/primitives';
import {
  EXPORT_COLUMNS,
  EXPORT_FILENAME,
  EXPORT_FORMATS,
  type ExportFormat,
} from '@/types';
import { FormatCard } from '../FormatCard/FormatCard';
import { useExport } from '../useExport/useExport';
import {
  Actions,
  ColumnPill,
  Columns,
  Count,
  Done,
  DoneActions,
  DoneFilename,
  DoneHeading,
  DoneLine,
  FileName,
  Filename,
  FileRow,
  Formats,
  SectionLabel,
  TickCircle,
} from './ExportModal.styles';

export interface ExportModalProps {
  /** Whether the dialog is on screen. Closed, it renders nothing at all. */
  open: boolean;
  /** What the ✕, _Cancel_, _Done_, Escape and a press on the scrim all ask for. */
  onClose: () => void;
}

/** What each **Format card** says, and what the export button reads once it is chosen. */
const FORMAT_COPY: Record<
  ExportFormat,
  { label: string; description: string; button: string }
> = {
  csv: {
    label: 'CSV',
    description: 'Plain comma-separated. Opens anywhere.',
    button: 'Export as CSV',
  },
  xlsx: {
    label: 'Excel',
    description: '.xlsx workbook with a header row.',
    button: 'Export as Excel',
  },
};

/** `1 movie`, `3 movies` — the count as the filename row and the done line say it. */
const movieLabel = (count: number): string =>
  `${count} ${count === 1 ? 'movie' : 'movies'}`;

/**
 * The **Export dialog**, 1:1 from `feat.ExportModal.dc.html`: the Modal with
 * the download glyph, _Export library_ and its line; _Format_ over the two
 * **Format cards**, CSV checked on every open; the filename row with the
 * **Export summary**'s count; _Columns included_ over the eight **Export
 * columns** as pills — a list, not controls; _Export as CSV_ / _Export as
 * Excel_ beside _Cancel_. Then **Export ready**, swapped inside the same card
 * as the one **Bare modal** so the pop-in runs once: the tick, the heading,
 * the filename and the count in the copy, and _Done_.
 *
 * The dialog owns `useExport`. The count is `null` until the summary lands
 * and blank on screen while so — it never blocks the export, and a done face
 * reached without one leaves the clause out rather than a hole in: _Saved
 * `family-library.csv` to your computer._ The button reads
 * _Exporting…_ and is disabled for the life of the request; the cards and
 * _Cancel_ are left alone. A request the server refuses leaves the idle face
 * exactly as it was — the Delete dialog's rule, since the prototype designs
 * no error face.
 */
export function ExportModal({ open, onClose }: ExportModalProps) {
  const { format, movieCount, exporting, done, chooseFormat, exportLibrary } =
    useExport(open);
  const formatLabelId = useId();
  const filename = EXPORT_FILENAME[format];
  const count = movieCount === null ? null : movieLabel(movieCount);

  if (done) {
    return (
      <Modal open={open} bare title="Export ready" onClose={onClose}>
        <Done>
          <TickCircle>
            <CheckIcon size={32} />
          </TickCircle>
          <DoneHeading>Export ready</DoneHeading>
          <DoneLine>
            Saved <DoneFilename>{filename}</DoneFilename>
            <br />
            {count === null
              ? 'to your computer.'
              : `with ${count} to your computer.`}
          </DoneLine>
          <DoneActions>
            <Button label="Done" variant="secondary" onClick={onClose} />
          </DoneActions>
        </Done>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title="Export library"
      subtitle="Save your whole collection as a spreadsheet."
      icon={<DownloadIcon size={22} />}
      onClose={onClose}
    >
      <div>
        <SectionLabel id={formatLabelId}>Format</SectionLabel>
        <Formats role="radiogroup" aria-labelledby={formatLabelId}>
          {EXPORT_FORMATS.map((key) => (
            <FormatCard
              key={key}
              label={FORMAT_COPY[key].label}
              description={FORMAT_COPY[key].description}
              selected={format === key}
              onSelect={() => chooseFormat(key)}
            />
          ))}
        </Formats>
      </div>

      <FileRow>
        <FileName>
          <SheetIcon size={18} />
          <Filename>{filename}</Filename>
        </FileName>
        {count === null ? null : <Count>{count}</Count>}
      </FileRow>

      <div>
        <SectionLabel>Columns included</SectionLabel>
        <Columns>
          {EXPORT_COLUMNS.map((column) => (
            <ColumnPill key={column}>{column}</ColumnPill>
          ))}
        </Columns>
      </div>

      <Actions>
        {/* The label is the whole of the in-flight state — the Delete
          dialog's "Deleting…" precedent: it says the work started, and the
          disabled button is what stops an impatient second press sending a
          second request. The cards and Cancel stay live. */}
        <Button
          label={exporting ? 'Exporting…' : FORMAT_COPY[format].button}
          variant="primary"
          disabled={exporting}
          onClick={() => {
            void exportLibrary();
          }}
        />
        <Button label="Cancel" variant="secondary" onClick={onClose} />
      </Actions>
    </Modal>
  );
}
