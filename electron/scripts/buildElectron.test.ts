// @vitest-environment node
//
// Issue #220 — the installed shape. build-electron drives esbuild through its
// API to emit two CJS bundles: main, with `electron` external, and the
// server, with `seriesSeed` excluded and — since issue #229 — `better-sqlite3`
// bundled, so neither needs a node_modules beside it. It is run
// by path with no `npx` and no shell (CLAUDE.md, "never use npx"), and
// `--outdir` points it somewhere other than `electron/dist` so this suite never
// writes over the bundles a developer is running.
//
// `package.json` names the main bundle as `"main"` and the app as
// `"productName": "FamilyFlix"`, which is what puts `userData` under
// `%APPDATA%\FamilyFlix\`; and `electron:start` runs the whole installed
// shape with every tool called by path.

import { spawn } from 'node:child_process';
import { builtinModules } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = join(root, 'electron', 'scripts', 'buildElectron.mjs');

interface PackageJson {
  main?: string;
  dependencies?: Record<string, string>;
  productName?: string;
  scripts: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8')
) as PackageJson;

/** Run the script with Node, by path and with no shell. */
function build(outdir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--outdir', outdir], {
      cwd: root,
      shell: false,
      stdio: 'ignore',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? -1));
  });
}

describe('build-electron', () => {
  let outdir: string;
  let exitCode: number;

  beforeAll(async () => {
    outdir = await mkdtemp(join(tmpdir(), 'familyflix-build-electron-'));
    exitCode = await build(outdir);
  }, 120_000);

  afterAll(async () => {
    await rm(outdir, { recursive: true, force: true });
  });

  it('runs to completion', () => {
    expect(exitCode).toBe(0);
  });

  it('emits the main bundle, with electron left external', async () => {
    const main = join(outdir, 'main.js');

    expect(existsSync(main)).toBe(true);
    expect(await readFile(main, 'utf8')).toMatch(/require\(["']electron["']\)/);
  });

  it('emits the server bundle, with better-sqlite3 bundled rather than external', async () => {
    // Issue #229 — the Installer ships no node_modules, so better-sqlite3's JS
    // travels inside the bundle; only its `.node` binding stays outside, and
    // every Shell mode hands that over as `nativeBinding`.
    const server = join(outdir, 'server.js');

    expect(existsSync(server)).toBe(true);
    const code = await readFile(server, 'utf8');
    // A boolean, so a failure does not print the whole bundle.
    expect(/require\(["']better-sqlite3["']\)/.test(code)).toBe(false);
    expect(code).toContain('Expected first argument to be a string');
  });

  it('requires nothing from node_modules at run time', async () => {
    // Issue #229 — a static require of anything but a Node builtin (or
    // `electron`, which the shell itself provides) would need a node_modules
    // the Installer does not ship.
    const builtins = new Set([
      ...builtinModules,
      ...builtinModules.map((name) => `node:${name}`),
      'electron',
    ]);

    for (const bundle of ['main.js', 'server.js']) {
      const code = await readFile(join(outdir, bundle), 'utf8');
      const required = [...code.matchAll(/require\(["']([^"']+)["']\)/g)].map(
        ([, name]) => name
      );
      const external = required.filter(
        (name) => !builtins.has(name) && !name.startsWith('.')
      );
      expect({ bundle, external }).toEqual({ bundle, external: [] });
    }
  });

  it('emits both as CommonJS', async () => {
    for (const bundle of ['main.js', 'server.js']) {
      const code = await readFile(join(outdir, bundle), 'utf8');
      expect(code).not.toMatch(/^\s*export\s/m);
      expect(code).not.toMatch(/^\s*import\s.+\sfrom\s/m);
    }
  });

  it('leaves seriesSeed out of the server bundle', async () => {
    const code = await readFile(join(outdir, 'server.js'), 'utf8');

    expect(code).not.toContain('__seed__/series/');
  });

  it('calls no npx and spawns nothing through a shell', () => {
    // Code only: the header comment is allowed to say why npx is avoided.
    const source = readFileSync(script, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(source).not.toMatch(/\bnpx\b/);
    expect(source).not.toMatch(/shell:\s*true/);
  });
});

describe('package.json', () => {
  it('names the main bundle as "main"', () => {
    expect(manifest.main).toBe('electron/dist/main.js');
  });

  it('declares no dependencies, so the Installer ships no node_modules', () => {
    // Issue #229 — every package is a devDependency: the bundles carry what
    // the app runs, and a package added to `dependencies` later would ship
    // in the Installer silently.
    expect(manifest.dependencies ?? {}).toEqual({});
    expect(manifest).toHaveProperty('dependencies');
  });

  it('names the app FamilyFlix, so userData is %APPDATA%\\FamilyFlix', () => {
    expect(manifest.productName).toBe('FamilyFlix');
  });

  it('has electron:start, calling no npx', () => {
    const start = manifest.scripts['electron:start'];

    expect(start).toBeDefined();
    expect(start).not.toMatch(/\bnpx\b/);

    // Issue #226 — and no tool in an `electron:*` script is called by bare
    // name: every command is `node` on a path, as `electron:dev` calls
    // `concurrently`, so none resolves through a `.cmd` shim.
    const electronScripts = Object.entries(manifest.scripts).filter(([name]) =>
      name.startsWith('electron:')
    );
    expect(electronScripts.map(([name]) => name)).toEqual(
      expect.arrayContaining(['electron:dev', 'electron:start'])
    );
    for (const [, command] of electronScripts) {
      for (const step of command.split('&&')) {
        expect(step.trim()).toMatch(/^node \S+/);
      }
    }
  });
});
