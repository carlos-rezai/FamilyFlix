// The module main hands `utilityProcess.fork()`, which then runs the
// **Server process**'s own entry. Issue #216.
//
// A utility process ignores `--import` in its `execArgv` — Electron starts it
// without Node's preload step — so `serverLaunch`'s `['--import', 'tsx']`
// would leave `server/src/main.ts` to Node's own loader, which cannot resolve
// its extensionless imports. This does the preload by hand: it is forked with
// `[entry, ...execArgv]` as its arguments, imports every `--import` module
// (resolved from the working directory, as Node resolves them), then the
// entry. With no `--import` it is the entry and nothing else.

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry, ...execArgv] = process.argv.slice(2);
const fromCwd = createRequire(join(process.cwd(), 'package.json'));

for (let at = 0; at < execArgv.length; at += 1) {
  if (execArgv[at] === '--import' && at + 1 < execArgv.length) {
    at += 1;
    await import(pathToFileURL(fromCwd.resolve(execArgv[at])).href);
  }
}

await import(pathToFileURL(entry).href);
