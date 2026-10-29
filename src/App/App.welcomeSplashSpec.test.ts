// @vitest-environment node
//
// 55, Intro animation, Phase 1 (issue #503): the **Welcome splash** in the
// spec. The frozen `docs/handoff/handoff-welcome-splash/` holds option 2a as
// received; `COMPONENT-SPEC.md` carries it over as its own section, naming its
// target under the App folder, its units, its **Welcome phase**s, its three
// curves and the **Welcome hold** and skip rules. The handoff itself is never
// edited: it stays as the commit that brought it in left it.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The repo's root, from here. */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The commit that brought the handoff in, as received (log 55 Q2). */
const HANDOFF_COMMIT = 'e9c9d09c';

/**
 * The spec's **Welcome splash** section: from its heading to the next heading
 * of the same or a higher level. Empty when there is no such heading.
 */
function welcomeSection(): string {
  const spec = readFileSync(`${ROOT}docs/handoff/COMPONENT-SPEC.md`, 'utf8');
  const lines = spec.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#+ .*Welcome splash/.test(line));
  if (start === -1) return '';
  const level = /^#+/.exec(lines[start])?.[0].length ?? 0;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(
    (line) => (/^(#+) /.exec(line)?.[1].length ?? Infinity) <= level
  );
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

describe('COMPONENT-SPEC.md: the Welcome splash section', () => {
  it('has a section for the Welcome splash, targeted under src/App/', () => {
    const section = welcomeSection();

    expect(section).not.toBe('');
    expect(section).toContain('src/App/');
  });

  it('names its four units', () => {
    const section = welcomeSection();

    for (const unit of [
      'WelcomeProvider',
      'WelcomeSplash',
      'useWelcome',
      'welcomeStep',
    ])
      expect(section).toContain(unit);
  });

  it('names its five phases', () => {
    const section = welcomeSection();

    for (const phase of ['intro', 'holding', 'handoff', 'skipping', 'done'])
      expect(section).toContain(`\`${phase}\``);
  });

  it('names its three curves', () => {
    const section = welcomeSection();

    for (const curve of ['easeDrop', 'easeSweep', 'easeGlide'])
      expect(section).toContain(curve);
  });

  it('carries the hold and skip rules', () => {
    const section = welcomeSection();

    expect(section).toContain('Welcome hold');
    expect(section).toMatch(/\bskip\b/i);
  });
});

describe('handoff-welcome-splash/: frozen', () => {
  it('is unchanged from the commit that brought it in', () => {
    // `git diff --exit-code` answers 1, and so throws, on any difference.
    expect(() =>
      execFileSync(
        'git',
        [
          'diff',
          '--exit-code',
          '--quiet',
          HANDOFF_COMMIT,
          '--',
          'docs/handoff/handoff-welcome-splash',
        ],
        { cwd: ROOT }
      )
    ).not.toThrow();
  });
});
