import { useId } from 'react';

import { Modal } from '@/components';
import {
  Button,
  CheckIcon,
  DownloadIcon,
  FolderIcon,
  TextField,
  Toggle,
} from '@/primitives';
import { EXPORT_COLUMNS, EXPORT_FORMATS, type ExportFormat } from '@/types';
import { FormatCard } from '../FormatCard/FormatCard';
import { useExport } from '../useExport/useExport';
import {
  Actions,
  ColumnPill,
  Columns,
  Count,
  Done,
  DoneActions,
  DoneHeading,
  DoneLine,
  DonePath,
  ExportName,
  Formats,
  IncludeCard,
  IncludeDesc,
  IncludeDivider,
  IncludeRow,
  IncludeText,
  IncludeTitle,
  NameLead,
  NameRow,
  PathRow,
  Refusal,
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

/**
 * `1 title`, `4 titles` — the count as the name row and the done line say
 * it.
 */
const titleLabel = (count: number): string =>
  `${count} ${count === 1 ? 'title' : 'titles'}`;

/** The last segment of a path — the **Export folder**'s own name. */
const folderNameOf = (path: string): string =>
  path
    .split(/[\\/]/)
    .filter((part) => part !== '')
    .pop() ?? path;

/**
 * The **Export dialog**, 1:1 from `feat.ExportModal.dc.html`: the Modal with
 * the download glyph, _Export library_ and its lede; _Format_ over the two
 * **Format cards**, CSV checked on every open; _Save to_, a mono field with
 * the folder glyph and the route's refusal under it; the name row — the
 * folder glyph, the **Export name** and the titles count; _Include_, the
 * _Images_ row and its Toggle, on every open, then the _Subtitles_ row,
 * off; _Columns included_ over the sixteen **Export columns** as pills — a
 * list, not controls; _Export as CSV_ / _Export as Excel_ beside _Cancel_.
 * Then **Export ready**, swapped inside the same card as the one **Bare
 * modal** so the pop-in runs once: the tick, the heading, the folder written
 * and where, and _Done_.
 *
 * The dialog owns `useExport`. The count is `null` until the summary lands
 * and absent on screen while so — it never blocks the export, and a done face
 * reached without one leaves the clause out rather than a hole in. The button
 * reads _Exporting…_ and is disabled for the life of the request. A refused
 * destination keeps the idle face and the path typed, its sentence under the
 * field; any other failure leaves the idle face exactly as it was.
 */
export function ExportModal({ open, onClose }: ExportModalProps) {
  const {
    format,
    summary,
    destination,
    images,
    subtitles,
    exporting,
    refusal,
    result,
    chooseFormat,
    setDestination,
    browse,
    setImages,
    setSubtitles,
    exportLibrary,
  } = useExport(open);
  const formatLabelId = useId();
  const count =
    summary === null
      ? null
      : titleLabel(summary.movieCount + summary.seriesCount);

  if (result !== null) {
    return (
      <Modal open={open} bare title="Export ready" onClose={onClose}>
        <Done>
          <TickCircle>
            <CheckIcon size={32} />
          </TickCircle>
          <DoneHeading>Export ready</DoneHeading>
          <DoneLine>
            Saved <DonePath>{folderNameOf(result.folder)}</DonePath>
            <br />
            to <DonePath>{destination}</DonePath>
            {count === null ? '.' : ` with ${count}.`}
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
      subtitle="Save your whole collection — details, artwork and all."
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

      <div>
        <SectionLabel>Save to</SectionLabel>
        <PathRow>
          <TextField
            value={destination}
            placeholder="E:\Movies"
            icon={<FolderIcon size={18} />}
            rounded={false}
            mono
            onChange={setDestination}
            aria-label="Save to"
          />
          {browse === null ? null : (
            <Button
              label="Browse…"
              variant="secondary"
              size="sm"
              onClick={() => {
                void browse();
              }}
            />
          )}
        </PathRow>
        {refusal === null ? null : <Refusal>{refusal}</Refusal>}
      </div>

      <NameRow>
        <NameLead>
          <FolderIcon size={18} />
          <ExportName>{summary?.folderName ?? ''}</ExportName>
        </NameLead>
        {count === null ? null : <Count>{count}</Count>}
      </NameRow>
      <div>
        <SectionLabel>Include</SectionLabel>
        <IncludeCard>
          <IncludeRow>
            <IncludeText>
              <IncludeTitle>Images</IncludeTitle>
              <IncludeDesc>
                Posters, backdrops and episode stills, in a folder per title.
              </IncludeDesc>
            </IncludeText>
            <Toggle
              checked={images}
              label="Images"
              onToggle={() => setImages(!images)}
            />
          </IncludeRow>
          <IncludeDivider />
          <IncludeRow>
            <IncludeText>
              <IncludeTitle>Subtitles</IncludeTitle>
              <IncludeDesc>
                Every subtitle file, beside its title&apos;s images.
              </IncludeDesc>
            </IncludeText>
            <Toggle
              checked={subtitles}
              label="Subtitles"
              onToggle={() => setSubtitles(!subtitles)}
            />
          </IncludeRow>
        </IncludeCard>
      </div>

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
