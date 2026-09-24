import {
  Button,
  FolderIcon,
  InfoRingIcon,
  SheetIcon,
  TextField,
} from '@/primitives';
import {
  Accepts,
  AcceptsBody,
  AcceptsGlyph,
  AcceptsHeading,
  AcceptsRule,
  AcceptsShapes,
  Actions,
  ErrorLine,
  Field,
  FieldLabel,
  Fields,
  Mono,
  Sans,
} from './ImportSetup.styles';

/**
 * The box both path fields are drawn as: the prototype's mono face in a 50px
 * box with the soft corner rather than the search bar's pill.
 */
const PATH_FIELD = { mono: true, height: 50, rounded: false } as const;

export interface ImportSetupProps {
  /** The spreadsheet path as typed. */
  sheet: string;
  /** The **Library root** path as typed. */
  root: string;
  /** The reason the last start refused the sheet, or `null` for none. */
  sheetError: string | null;
  /** The reason the last start refused the root, or `null` for none. */
  rootError: string | null;
  onSheet: (value: string) => void;
  onRoot: (value: string) => void;
  onStart: () => void;
}

/**
 * The **Setup step**, from `feat.ImportFlow.dc.html`: two paths typed into two
 * mono fields — the spreadsheet, led by the sheet glyph, and the **Library
 * root**, led by the folder glyph — and _Start import_, disabled until both
 * are non-empty. Between the root and the button, _What the scanner accepts_:
 * the three folder shapes, with the prototype's backslashes, and the
 * folder-first rule.
 *
 * Controlled: the values, the two refusals and the three handlers are handed
 * in, because it is the organism that holds the values and decides when a
 * refusal clears. A refusal is drawn under the field the `400` named, as the
 * 13px danger line.
 */
export function ImportSetup({
  sheet,
  root,
  sheetError,
  rootError,
  onSheet,
  onRoot,
  onStart,
}: ImportSetupProps) {
  const ready = sheet.trim() !== '' && root.trim() !== '';

  return (
    <Fields>
      <Field>
        <FieldLabel>Spreadsheet</FieldLabel>
        <TextField
          {...PATH_FIELD}
          value={sheet}
          placeholder="C:\Movies\library.xlsx"
          icon={<SheetIcon size={20} />}
          aria-label="Spreadsheet"
          onChange={onSheet}
        />
        {sheetError === null ? null : <ErrorLine>{sheetError}</ErrorLine>}
      </Field>

      <Field>
        <FieldLabel>Movies root folder</FieldLabel>
        <TextField
          {...PATH_FIELD}
          value={root}
          placeholder="C:\Movies"
          icon={<FolderIcon size={20} />}
          aria-label="Movies root folder"
          onChange={onRoot}
        />
        {rootError === null ? null : <ErrorLine>{rootError}</ErrorLine>}
      </Field>

      <Accepts>
        <AcceptsGlyph>
          <InfoRingIcon size={18} />
        </AcceptsGlyph>
        <AcceptsBody>
          <AcceptsHeading>What the scanner accepts</AcceptsHeading>
          <AcceptsShapes>
            {'Movie Title (2019)\\ movie.mkv · subs.en.srt'}
            <br />
            {'Show Name\\ Season 01\\ S01E03.mkv'}
            <br />
            {'Show Name\\ S01E03.mkv '}
            <Sans>— loose episodes at the show root are fine</Sans>
          </AcceptsShapes>
          <AcceptsRule>
            Season and episode numbers come from the folder first, then the
            filename (<Mono>S01E03</Mono>, <Mono>1x03</Mono>). Anything it can’t
            place lands in the review list.
          </AcceptsRule>
        </AcceptsBody>
      </Accepts>

      <Actions>
        <Button label="Start import" disabled={!ready} onClick={onStart} />
      </Actions>
    </Fields>
  );
}
