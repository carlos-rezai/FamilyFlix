// @vitest-environment node
//
// 52, Keep originals, phase 5 (issue #478): the Shell trash goes whole. The
// **Shell handshake** is back to `ready`, `fatal` and `shutdown`; nothing in
// the shell, the server or the client names a trash any more, and the
// **Media** domain is made from its media path alone.
//
// Read off the source itself, parsed by TypeScript, so a comment or a string
// that merely says the word is no identifier; only what the code names.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const TREES = ['electron', join('server', 'src'), 'src'];
const SKIPPED = new Set(['node_modules', 'dist']);
const SCAN_TIMEOUT = 120_000;

/** Every `.ts` / `.tsx` file under `dir`, build output skipped. */
function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED.has(entry.name) ? [] : sourcesUnder(path);
    }
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [path]
      : [];
  });
}

let parsed: ts.SourceFile[] | undefined;

/** The three trees' sources, parsed once. */
function sources(): ts.SourceFile[] {
  parsed ??= TREES.flatMap((tree) => sourcesUnder(join(REPO, tree))).map(
    (path) =>
      ts.createSourceFile(
        relative(REPO, path),
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        false,
        path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      )
  );
  return parsed;
}

/** Every node under `node`, depth first. */
function* walk(node: ts.Node): Generator<ts.Node> {
  yield node;
  const children: ts.Node[] = [];
  ts.forEachChild(node, (child) => {
    children.push(child);
  });
  for (const child of children) {
    yield* walk(child);
  }
}

/** The file's own name for itself, so this test's words are not counted. */
const SELF = relative(REPO, fileURLToPath(import.meta.url));

describe('shellHandshake: no Shell trash', () => {
  it('types the handshake as ready, fatal and shutdown alone', () => {
    const shell = readFileSync(join(REPO, 'src', 'types', 'shell.ts'), 'utf8');
    const file = ts.createSourceFile('shell.ts', shell, ts.ScriptTarget.Latest);
    const types = [...walk(file)]
      .filter(ts.isPropertySignature)
      .filter((member) => member.name.getText(file) === 'type')
      .map((member) => member.type?.getText(file).replace(/['"]/g, ''));

    expect(types.sort()).toEqual(['fatal', 'ready', 'shutdown']);
  });

  it(
    'leaves no trash identifier in electron/, server/src/ or src/',
    () => {
      const named = sources()
        .filter((file) => file.fileName !== SELF)
        .flatMap((file) =>
          [...walk(file)]
            .filter(ts.isIdentifier)
            .filter((identifier) => /trash/i.test(identifier.text))
            .map(
              (identifier) =>
                `${file.fileName.replace(/\\/g, '/')}: ${identifier.text}`
            )
        );

      expect([...new Set(named)]).toEqual([]);
    },
    SCAN_TIMEOUT
  );

  it(
    'makes the Media domain from its media path alone, everywhere',
    () => {
      const wider = sources().flatMap((file) =>
        [...walk(file)].flatMap((node) => {
          const where = file.fileName.replace(/\\/g, '/');
          if (
            ts.isFunctionDeclaration(node) &&
            node.name?.text === 'createMedia' &&
            node.parameters.length !== 1
          ) {
            return [`${where}: declares ${node.parameters.length} parameters`];
          }
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'createMedia' &&
            node.arguments.length !== 1
          ) {
            return [`${where}: called with ${node.arguments.length}`];
          }
          return [];
        })
      );

      expect(wider).toEqual([]);
    },
    SCAN_TIMEOUT
  );
});
