import { extname } from 'node:path';

import type { Cue } from '@/types';

import { parseAss } from '../parseAss/parseAss';
import { parseSrt } from '../parseSrt/parseSrt';
import { parseSub } from '../parseSub/parseSub';
import { parseVtt } from '../parseVtt/parseVtt';

/**
 * The seam the four parsers exist for: the last place in the app that knows a
 * subtitle file has a format.
 *
 * It picks a parser from the extension and answers a **Cue list**, and nothing
 * downstream — not the route, not `fetchSubtitleCues`, not `cueAt`, not the
 * **Subtitle overlay** — ever asks again. Four formats in, one shape out, and
 * no consumer with a reason to branch.
 *
 * **The extension decides, not the contents.** Sniffing would quietly make the
 * name decorative, and the file names are what the maintainer controls; SubRip
 * contents under a `.sub` name is a mislabelled file, and the answer is no cues
 * rather than a guess.
 *
 * Every way of having nothing to say is the same empty list: an extension the
 * scanner never attaches, a path with no extension at all, and a file of the
 * right name that will not parse. The route turns all of them into `200 []`, so
 * the film plays on without subtitles rather than failing to play.
 */
const PARSERS: Record<string, (source: string) => Cue[]> = {
  '.srt': parseSrt,
  '.vtt': parseVtt,
  '.ass': parseAss,
  '.sub': parseSub,
};

export function parseSubtitle(path: string, source: string): Cue[] {
  // Windows hands back `EN.SRT` as readily as `en.srt`, and the family folder
  // was not tidied first.
  const parse = PARSERS[extname(path).toLowerCase()];
  return parse ? parse(source) : [];
}
