// @vitest-environment node
//
// Issue #111: let RED `test:` commits pass the pre-commit hook without
// `--no-verify`.
//
// **The problem this decides.** Every `test:` commit that stops at RED was made
// with `--no-verify`, because a test written against a module that does not
// exist yet cannot typecheck — which is the entire point of the RED step, so
// the bypass was legitimate every single time. The `movie-form` initiative did
// it ten times in a row.
//
// The cost is that the gate being skipped is the only one that would catch a
// *genuine* type error in a test file, and it was skipped on exactly the commits
// that add test files. `npm run typecheck` was red for six consecutive commits
// during the player initiative and carried anyway, because nothing ran it.
//
// So the gate is not removed on a RED commit — it is **narrowed** to the code
// that must always compile. This function is what decides that, and it is the
// thing worth testing: everything else in the chain is a `tsc` invocation.
//
// **A subject is trusted to relax the gate, so it is read strictly.** Only an
// exact `test:` at the start of the real subject line narrows anything.
// Anything else — a different type, a different case, the word appearing later,
// a message that says nothing — typechecks everything, because the failure
// direction that costs something is a gate that quietly stopped running.

import { describe, expect, it } from 'vitest';

import {
  ALL_PROJECTS,
  SHIPPING_PROJECTS,
  projectsFor,
} from './commitTypecheck.mjs';

/** A commit message as git hands one to `commit-msg`: subject, blank, body. */
const message = (subject: string, body = ''): string =>
  body === '' ? `${subject}\n` : `${subject}\n\n${body}\n`;

/**
 * The comment block git appends to a message being written in an editor. The
 * hook is handed the file including these, so the subject is the first line
 * that is neither blank nor a comment — never simply the first line.
 */
const GIT_TEMPLATE = [
  '# Please enter the commit message for your changes. Lines starting',
  "# with '#' will be ignored, and an empty message aborts the commit.",
  '#',
  '# On branch main',
].join('\n');

describe('projectsFor — a RED test commit', () => {
  it('narrows the gate to the shipping projects', () => {
    expect(projectsFor(message('test: [movie-form] issue #107 runtime, RED'))).toEqual(
      SHIPPING_PROJECTS
    );
  });

  it('names the frontend and the backend, and not the tests', () => {
    // Stated as the thing the whole issue turns on: `src` and `server` must
    // always compile; the tests are deliberately ahead of the code.
    expect(SHIPPING_PROJECTS).toEqual([
      'tsconfig.app.json',
      'tsconfig.server.json',
    ]);
    expect(SHIPPING_PROJECTS).not.toContain('tsconfig.spec.json');
  });

  it('reads the subject past the comments git appends', () => {
    expect(
      projectsFor(`test: [player] issue #7 the cue offset, RED\n\n${GIT_TEMPLATE}\n`)
    ).toEqual(SHIPPING_PROJECTS);
  });

  it('reads the subject past leading blank lines', () => {
    expect(projectsFor('\n\ntest: [library] issue #9 RED\n')).toEqual(
      SHIPPING_PROJECTS
    );
  });

  it('reads a subject git has not yet stripped the indentation from', () => {
    expect(projectsFor('  test: [library] issue #9 RED\n')).toEqual(
      SHIPPING_PROJECTS
    );
  });
});

describe('projectsFor — every other commit', () => {
  it.each([
    'feat: [movie-form] issue #99 the genre pool',
    'fix: [player] issue #7 correct subtitle track offset',
    'refactor: [library] issue #9 extract genre-row hook',
    'chore: [tooling] issue #110 track the workflow',
    'docs: [movie-form] issue #108 the docs',
  ])('typechecks everything for %s', (subject) => {
    expect(projectsFor(message(subject))).toEqual(ALL_PROJECTS);
  });

  it('typechecks everything, which is the whole solution file', () => {
    expect(ALL_PROJECTS).toEqual(['tsconfig.json']);
  });
});

// The gate relaxes on the strength of a string the committer wrote, so every
// case below is a way of writing something that is not a RED commit and having
// it read as one.
describe('projectsFor — what must not relax the gate', () => {
  it('refuses a type that merely starts with the word', () => {
    expect(projectsFor(message('testing: the new harness'))).toEqual(
      ALL_PROJECTS
    );
  });

  it('refuses a type that only differs in case', () => {
    // `test` is the type CLAUDE.md names. `Test` is not one, and a gate that
    // guessed would be a gate that can be turned off by a typo.
    expect(projectsFor(message('Test: [player] issue #7 RED'))).toEqual(
      ALL_PROJECTS
    );
  });

  it('refuses a subject with no colon after the type', () => {
    expect(projectsFor(message('test the new harness'))).toEqual(ALL_PROJECTS);
  });

  // The one most likely to happen by accident: a refactor commit whose body
  // explains what it did to the tests.
  it('refuses the word appearing in the body rather than the subject', () => {
    expect(
      projectsFor(
        message(
          'refactor: [movie-form] issue #109 one part handler',
          'test: the 288 route tests are unedited and green.'
        )
      )
    ).toEqual(ALL_PROJECTS);
  });

  it('refuses a message that is only comments', () => {
    expect(projectsFor(`${GIT_TEMPLATE}\n`)).toEqual(ALL_PROJECTS);
  });

  it('refuses an empty message', () => {
    expect(projectsFor('')).toEqual(ALL_PROJECTS);
  });

  it('refuses a message of nothing but whitespace', () => {
    expect(projectsFor('\n  \n\t\n')).toEqual(ALL_PROJECTS);
  });

  it('refuses a commented-out subject that says test:', () => {
    // `# test: ...` is a line git throws away, so it names no commit.
    expect(projectsFor('# test: [player] issue #7 RED\nfeat: something\n')).toEqual(
      ALL_PROJECTS
    );
  });
});
