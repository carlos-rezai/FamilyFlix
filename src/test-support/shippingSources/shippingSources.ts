import { readdirSync, readFileSync } from 'node:fs';

/**
 * Every `.ts`/`.tsx` file under `root` that ships, by path with forward
 * slashes, so a failure names the same file on every machine. Tests are not
 * shipping code and neither is `test-support/` — the probe's own Back button
 * and the suites' stand-ins for browser chrome break the rules the structural
 * guards hold the app to, on purpose.
 */
export function shippingSources(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .map((entry) => `${root}/${entry}`.replace(/\\/g, '/'))
    .filter(
      (path) => /\.tsx?$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path)
    )
    .filter((path) => !path.includes('/test-support/'));
}

/**
 * A source with its comments removed — prose about `navigate(-1)` or
 * `video.duration` is not a call or a read of it, and a codebase whose
 * docblocks discuss the very pattern being guarded would otherwise fail its
 * guards for sentences.
 */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * The shipping files under `root` whose _code_ matches `pattern` — the one
 * question every structural guard asks: which files contain this, comments
 * aside. By path, so a failure names them.
 */
export function shippingSourcesMatching(
  root: string,
  pattern: RegExp
): string[] {
  return shippingSources(root).filter((path) =>
    pattern.test(withoutComments(readFileSync(path, 'utf8')))
  );
}
