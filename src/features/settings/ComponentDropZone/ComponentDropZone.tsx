import { useState, type ChangeEvent, type DragEvent } from 'react';

import { UploadIcon } from '@/primitives';

import type { UploadState } from '../useCapabilities/useCapabilities';
import {
  Glyph,
  Input,
  Line,
  Mono,
  Title,
  Zone,
} from './ComponentDropZone.styles';

export interface ComponentDropZoneProps {
  /** What the zone is doing, and so which of its three faces it draws. */
  upload: UploadState;
  /** The files as they came — sorted by nothing, labelled as nothing. */
  onFiles: (files: File[]) => void;
}

/**
 * The **Component drop zone**, `feat.CodecManager.dc.html` → the dashed _Add
 * a codec pack_ box under the rows: a `<label>` over a visually hidden
 * `<input type="file" multiple>`, taking a drop or a pick of the two
 * **Component binaries** and reporting them as they came.
 *
 * It sorts nothing and labels nothing: both files go up as they are and the
 * route tells them apart by filename. A zone that decided which half a file
 * was would be a client the server trusted.
 *
 * **Three faces**, the three the **Upload state** has: **idle** as drawn;
 * **busy**, with the input disabled and a second drop reporting nothing, so
 * two uploads cannot race into the same slot; and **refused**, which keeps the
 * title and puts the route's own reason in the danger ink on the second line,
 * where it stays until the next attempt replaces it — silence on a refusal was
 * rejected, because a `.dll` dropped by a parent following the old copy must
 * not do nothing.
 *
 * **Replaced is not a face**: the write echoes the **Codec report** and the
 * screen redraws from it — no success flash, no snackbar.
 *
 * The words stay the family's. The zone says _codec pack_ because that is what
 * they drop; the code, the wire and the glossary say **Playback component**.
 */
export function ComponentDropZone({ upload, onFiles }: ComponentDropZoneProps) {
  const [over, setOver] = useState(false);

  const busy = upload.kind === 'busy';
  const refused = upload.kind === 'refused';

  const report = (files: FileList | null) => {
    // A cancelled dialog and an empty drop are both nothing at all.
    const picked = Array.from(files ?? []);
    if (picked.length > 0) {
      onFiles(picked);
    }
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    // Without the default prevented the drop navigates the window to the file,
    // and the Settings page is gone.
    event.preventDefault();
    if (!busy) {
      setOver(true);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    if (!busy) {
      report(event.dataTransfer.files);
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    report(event.target.files);
    // Cleared after every pick, so the same pair chosen twice is heard twice.
    event.target.value = '';
  };

  return (
    <Zone
      $over={over}
      $busy={busy}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <Glyph>
        <UploadIcon size={24} />
      </Glyph>
      <Title>
        {busy ? 'Adding the playback component…' : 'Add a codec pack'}
      </Title>
      {busy && <Line $refused={false}>Copying it in and checking it runs</Line>}
      {refused && <Line $refused>{upload.reason}</Line>}
      {!busy && !refused && (
        <Line $refused={false}>
          Drop a playback component (<Mono>ffmpeg</Mono>) here, or browse
        </Line>
      )}
      <Input type="file" multiple disabled={busy} onChange={onChange} />
    </Zone>
  );
}
