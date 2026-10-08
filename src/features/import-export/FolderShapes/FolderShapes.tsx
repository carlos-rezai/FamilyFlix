import { InfoRingIcon } from '@/primitives';
import {
  Accepts,
  AcceptsBody,
  AcceptsGlyph,
  AcceptsHeading,
  AcceptsRule,
  AcceptsShapes,
  Mono,
  Sans,
} from './FolderShapes.styles';

/**
 * _What the scanner accepts_, from `feat.ImportFlow.dc.html`: the three folder
 * shapes in mono with the prototype's backslashes — the loose shape's note in
 * the sans face — then the folder-first rule, its two tags in mono. No props:
 * Import setup and the Library folders page's group **Scan** draw the same
 * block.
 */
export function FolderShapes() {
  return (
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
  );
}
