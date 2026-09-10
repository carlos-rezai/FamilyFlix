/**
 * Which tsconfig projects a commit's typecheck gate should cover.
 *
 * Issue #111. A test written against a module that does not exist yet cannot
 * typecheck, which is the entire point of the RED step — so every `test:`
 * commit was made with `--no-verify`, and the gate being skipped was the only
 * one that would catch a *genuine* type error in a test file. It was skipped on
 * exactly the commits that add test files, and `npm run typecheck` was
 * consequently red for six consecutive commits during the player initiative
 * before anybody noticed.
 *
 * The answer is to narrow the gate on a RED commit rather than remove it.
 */

/**
 * The projects that must compile on every commit without exception: the
 * frontend and the backend, and not the tests.
 *
 * `tsconfig.spec.json` covers the tests, which on a RED commit are deliberately
 * ahead of the code they describe.
 */
export const SHIPPING_PROJECTS = [
  'tsconfig.app.json',
  'tsconfig.server.json',
] as const;

/** The whole solution file, which is what every other commit typechecks. */
export const ALL_PROJECTS = ['tsconfig.json'] as const;

/**
 * The type a message declares — `test`, `feat`, `fix` … — or `null` for a
 * message that declares none.
 *
 * The subject is the first line that is neither blank nor a comment, because
 * git hands `commit-msg` the file it is about to strip rather than the message
 * it will keep. A commented-out line names no commit.
 */
function commitType(message: string): string | null {
  const subject = message
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('#'));

  if (subject === undefined) {
    return null;
  }

  // Exactly the lowercase type CLAUDE.md names, followed by its colon. Anchored
  // at both ends of the type so `testing:` is not `test`, and case-sensitive so
  // a gate cannot be turned off by a typo.
  const declared = /^([a-z]+):/.exec(subject);
  return declared === null ? null : declared[1];
}

/**
 * The projects to typecheck for `message`, which is the commit message file's
 * whole contents as `commit-msg` is handed it.
 *
 * **Only an exact `test:` narrows anything.** Everything else typechecks
 * everything — a different type, a different case, the word appearing in the
 * body, a message that says nothing at all. The gate relaxes on the strength of
 * a string the committer wrote, and the failure direction that costs something
 * is a gate that quietly stopped running.
 */
export function projectsFor(message: string): readonly string[] {
  return commitType(message) === 'test' ? SHIPPING_PROJECTS : ALL_PROJECTS;
}
