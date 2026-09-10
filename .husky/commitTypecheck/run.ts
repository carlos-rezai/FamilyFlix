import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { projectsFor } from './commitTypecheck';

/**
 * The typecheck gate, run from `commit-msg` with the path to the message file.
 *
 * It lives in `commit-msg` rather than `pre-commit` because that is the first
 * hook the message is available to at all: `pre-commit` runs before git has
 * written it, so `COMMIT_EDITMSG` there still holds the *previous* commit's
 * message. Aborting from here refuses the commit exactly as aborting from
 * `pre-commit` does.
 *
 * It spawns **`node` on tsc's own entry point** rather than `npx tsc` or the
 * `node_modules/.bin/tsc` shim, which is `.lintstagedrc`'s existing pattern and
 * exists for CLAUDE.md's reason: on Windows `npx` — and any bare shim — resolves
 * through `.cmd`, which spawns `cmd.exe` and allocates a console window that
 * flashes on screen and steals focus. `node` on a `.js` file needs no shell at
 * all, which is also why `shell` stays false: passing `shell: true` to run the
 * shim would put `cmd.exe` back.
 */
const messageFile = process.argv[2];
if (messageFile === undefined) {
  process.stderr.write('commit-msg: no message file given\n');
  process.exit(1);
}

const projects = projectsFor(readFileSync(messageFile, 'utf8'));

// Said out loud, because a gate that narrows silently is one nobody notices has
// stopped running.
if (projects.length > 1) {
  process.stdout.write(
    'RED test commit — typechecking shipping code only (src, server).\n'
  );
}

const tsc = spawnSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '-b', ...projects],
  { stdio: 'inherit', shell: false }
);

process.exit(tsc.status ?? 1);
