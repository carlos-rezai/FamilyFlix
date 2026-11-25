import { Fragment } from 'react';
import { InfoRingIcon } from '@/primitives';
import {
  Accepts,
  AcceptsBody,
  AcceptsExample,
  AcceptsExamples,
  AcceptsGlyph,
  AcceptsHeading,
  AcceptsRule,
  Mono,
} from './FolderShapes.styles';

/** Two no-break spaces: one level of nesting in an example. */
const INDENT = '  ';

/** An example's lines, each with its depth of nesting. */
type ExampleLine = readonly [depth: number, text: string];

const FILM: readonly ExampleLine[] = [
  [0, 'Heat (1995)\\'],
  [1, 'Heat.mkv'],
  [1, 'Images\\poster.jpg'],
  [1, 'Images\\backdrop.jpg'],
  [1, 'Subtitles\\English.srt'],
];

const SERIES: readonly ExampleLine[] = [
  [0, 'The Show (2019)\\'],
  [1, 'Images\\poster.jpg'],
  [1, 'Season 01\\'],
  [2, 'The Show S01E01.mkv'],
  [2, 'Images\\poster.jpg'],
  [2, 'Images\\Stills\\S01E01.jpg'],
  [2, 'Subtitles\\S01E01\\English.srt'],
];

function Example({ lines }: { lines: readonly ExampleLine[] }) {
  return (
    <AcceptsExample>
      {lines.map(([depth, text], index) => (
        <Fragment key={index}>
          {index > 0 && <br />}
          {INDENT.repeat(depth) + text}
        </Fragment>
      ))}
    </AcceptsExample>
  );
}

/**
 * _What the scanner accepts_, from the amended `feat.ImportFlow.dc.html`: a
 * film and a series example side by side in mono, then the three rules, their
 * folder and file names in mono, and the **Sheet note** in the rules' style,
 * its path in mono. No props: Import setup and the Library folders page's
 * group **Scan** draw the same block.
 */
export function FolderShapes() {
  return (
    <Accepts>
      <AcceptsGlyph>
        <InfoRingIcon size={18} />
      </AcceptsGlyph>
      <AcceptsBody>
        <AcceptsHeading>What the scanner accepts</AcceptsHeading>
        <AcceptsExamples>
          <Example lines={FILM} />
          <Example lines={SERIES} />
        </AcceptsExamples>
        <AcceptsRule>
          A folder with one video is a film; one with Season folders (
          <Mono>Season 01</Mono>) is a series.
        </AcceptsRule>
        <AcceptsRule>
          Each episode’s number comes from its filename (<Mono>S01E03</Mono>,{' '}
          <Mono>1x03</Mono>), its season from its Season folder.
        </AcceptsRule>
        <AcceptsRule>
          Art goes in <Mono>{'Images\\'}</Mono>, named ending in{' '}
          <Mono>poster</Mono> or <Mono>backdrop</Mono>; subtitles go in{' '}
          <Mono>{'Subtitles\\'}</Mono>. Anything it can’t place lands in the
          review list.
        </AcceptsRule>
        <AcceptsRule>
          FamilyFlix keeps a sheet of each folder’s titles in{' '}
          <Mono>{'_meta\\familyflix-library.csv'}</Mono> and reads it first, so
          a scan after a reset or on another computer brings every title back as
          it was, ratings, hearts and what’s been watched included.
        </AcceptsRule>
      </AcceptsBody>
    </Accepts>
  );
}
