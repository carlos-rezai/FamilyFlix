// @vitest-environment node
//
// 59, Rebuild whole, Phase 13 (issue #560): the documents.
//
// Step 42's row in the feature checklist is written to what was built and
// stays 🔜 until the refactor. Each unit the step changed says what it now
// does in its docblocks, naming the glossary terms it uses in bold:
// **Round trip**, **Layout read**, **Path cells**, **Layout place**,
// **File plan**, **Orphaned row**, **Library sheet writer**,
// **Show folder read** and **Layout warning**. The glossary names only the
// units the build made, a retired one only as retired, and CLAUDE.md is
// untouched.
//
// The files are read off the disk, as `src/tokens/brand.test.ts` reads
// `LogoLoader`'s docblock; CLAUDE.md is compared with the commit this slice
// started from.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The commit the documents slice started from. */
const SLICE_BASE = '0e2d727e';

/** The repo's root, from here. */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** A file of the repo, read from its root, line endings as LF. */
function repoFile(path: string): string {
  return readFileSync(`${ROOT}${path}`, 'utf8').replace(/\r\n/g, '\n');
}

/** Every `/** ... *\/` docblock in a source, joined. */
function docblocks(source: string): string {
  return [...source.matchAll(/\/\*\*[\s\S]*?\*\//g)]
    .map((match) => match[0])
    .join('\n');
}

/** The glossary terms a docblock spells in bold, comment stars removed. */
function boldTerms(source: string): string {
  return docblocks(source).replace(/\n\s*\*\s?/g, ' ');
}

/** Step 42's row of the feature checklist: its line and its indented lines. */
function stepRow(): string {
  const checklist = repoFile('docs/feature-checklist.md');
  const start = checklist.search(/^42\. /m);

  expect(start).toBeGreaterThan(-1);

  const rest = checklist.slice(start);
  const end = rest.search(/\n\n(?! )/);

  return end === -1 ? rest : rest.slice(0, end);
}

/** The glossary's Rebuild whole section, to the next heading. */
function rebuildWholeSection(): string {
  const glossary = repoFile('docs/ubiquitous-language.md');
  const start = glossary.indexOf('## Rebuild whole');

  expect(start).toBeGreaterThan(-1);

  const rest = glossary.slice(start + 1);
  const end = rest.search(/\n## /);

  return end === -1 ? rest : rest.slice(0, end);
}

/** Whether a name is declared or exported by any shipping file under server/src. */
function isBuilt(name: string): boolean {
  try {
    return gitGrep(name).length > 0;
  } catch {
    // git grep exits 1 when nothing matches.
    return false;
  }
}

/** The shipping files under server/src that declare a name. */
function gitGrep(name: string): string {
  return execFileSync(
    'git',
    [
      'grep',
      '-l',
      '-E',
      `(function|const|type|interface|class) ${name}\\b`,
      '--',
      'server/src/*.ts',
      ':(exclude)*.test.ts',
      ':(exclude)server/src/test-support/*',
    ],
    { cwd: ROOT, encoding: 'utf8' }
  ).trim();
}

describe("the documents: step 42's row of the feature checklist", () => {
  it('is still 🔜, built but not refactored', () => {
    expect(stepRow()).toMatch(/^42\. 🔜 \*\*Rebuild whole\*\*/);
  });

  it('describes the build in the terms it named', () => {
    const row = stepRow();

    for (const term of ['Round trip', 'Path cells', 'Orphaned row']) {
      expect(row, term).toContain(`**${term}**`);
    }
  });
});

describe("the documents: each changed unit's docblocks", () => {
  const cases: [path: string, terms: string[]][] = [
    ['server/src/import-export/numberShow/numberShow.ts', ['Show folder read']],
    [
      'server/src/media/readTitleFolder/readTitleFolder.ts',
      ['Layout read', 'Layout warning', 'Show folder read'],
    ],
    [
      'server/src/import-export/readShowFolder/readShowFolder.ts',
      ['Show folder read'],
    ],
    [
      'server/src/import-export/exportRows/exportRows.ts',
      ['Path cells', 'Layout place', 'File plan', 'Layout read'],
    ],
    [
      'server/src/import-export/filePlan/filePlan.ts',
      ['File plan', 'Path cells', 'Layout place'],
    ],
    [
      'server/src/import-export/layoutCells/layoutCells.ts',
      ['Layout read', 'Path cells', 'Layout place'],
    ],
    [
      'server/src/import-export/createLibrarySheet/createLibrarySheet.ts',
      ['Library sheet writer', 'Layout read', 'Path cells', 'Round trip'],
    ],
    [
      'server/src/import-export/createImporter/createImporter.ts',
      ['Orphaned row', 'Round trip', 'Path cells'],
    ],
    [
      'server/src/import-export/planSheetFields/planSheetFields.ts',
      ['Round trip'],
    ],
  ];

  it.each(cases)('%s names its glossary terms in bold', (path, terms) => {
    const text = boldTerms(repoFile(path));
    const missing = terms.filter((term) => !text.includes(`**${term}**`));

    expect(missing).toEqual([]);
  });
});

describe('the documents: the glossary', () => {
  it('names a retired unit only as retired', () => {
    const glossary = repoFile('docs/ubiquitous-language.md');
    const stale = glossary
      .split('\n')
      .filter((line) => /`(groupShows|scansUnder)`/.test(line))
      .filter((line) => !/retired|until log 59/i.test(line));

    expect(stale).toEqual([]);
  });

  it('names in the Rebuild whole section only units the build made', () => {
    const section = rebuildWholeSection();
    const names = [...section.matchAll(/`([a-zA-Z]+[A-Z][a-zA-Z]*)/g)].map(
      (match) => match[1]
    );
    const retiredOrWire = /^(plannerFor)$/;
    const unbuilt = [...new Set(names)]
      .filter((name) => !retiredOrWire.test(name))
      .filter((name) => !isBuilt(name));

    expect(names.length).toBeGreaterThan(0);
    expect(unbuilt).toEqual([]);
  });
});

describe('the documents: CLAUDE.md', () => {
  it('is unchanged since the slice began', () => {
    const before = execFileSync(
      'git',
      ['show', `${SLICE_BASE}:.claude/CLAUDE.md`],
      { cwd: ROOT, encoding: 'utf8' }
    ).replace(/\r\n/g, '\n');

    expect(repoFile('.claude/CLAUDE.md')).toBe(before);
  });
});
