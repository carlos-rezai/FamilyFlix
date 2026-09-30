// @vitest-environment node
//
// Issue #224 — failures and logs. The **Shell log**: in the **Installed app**,
// main's output and the server's stdout/stderr append to
// `logs\familyflix.log`, tagged `[main]` and `[server]`; at startup a file over
// 5 MB is renamed to `familyflix.old.log`, replacing the previous one. An
// **Unpackaged run** prints the same tagged lines to the terminal and writes
// no file.
//
// The file system is injected: an in-memory one here, whose `rename` replaces
// its target the way Windows' `fs.renameSync` does.

import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { LOG_ROLL_BYTES, shellLog, type LogFileSystem } from './shellLog';

const DIR = join('appdata', 'FamilyFlix', 'logs');
const LOG = join(DIR, 'familyflix.log');
const OLD = join(DIR, 'familyflix.old.log');

class MemoryFs implements LogFileSystem {
  readonly files = new Map<string, string>();
  readonly sizes = new Map<string, number>();
  readonly calls: string[] = [];

  size(path: string): number | undefined {
    this.calls.push(`size ${path}`);
    if (this.sizes.has(path)) return this.sizes.get(path);
    const text = this.files.get(path);
    return text === undefined ? undefined : Buffer.byteLength(text);
  }

  rename(from: string, to: string): void {
    this.calls.push(`rename ${from} ${to}`);
    const text = this.files.get(from);
    if (text === undefined) throw new Error(`ENOENT: ${from}`);
    this.files.set(to, text);
    this.files.delete(from);
    this.sizes.delete(from);
  }

  append(path: string, text: string): void {
    this.calls.push(`append ${path}`);
    this.files.set(path, (this.files.get(path) ?? '') + text);
  }

  mkdir(dir: string): void {
    this.calls.push(`mkdir ${dir}`);
  }
}

const lines = (text: string | undefined) =>
  (text ?? '').split('\n').filter((line) => line.length > 0);

describe('shellLog — the file', () => {
  it('tags main’s lines [main] and the server’s [server] in familyflix.log', () => {
    const fs = new MemoryFs();
    const terminal = vi.fn();
    const log = shellLog({ toFile: true, dir: DIR, fs, terminal });

    log.main('window opened');
    log.server('listening on 127.0.0.1:41720\n');

    const written = lines(fs.files.get(LOG));
    expect(written).toHaveLength(2);
    expect(written[0]).toMatch(/\[main\] window opened$/);
    expect(written[1]).toMatch(/\[server\] listening on 127\.0\.0\.1:41720$/);
  });

  it('tags every line of a server chunk that carries several', () => {
    const fs = new MemoryFs();
    const log = shellLog({ toFile: true, dir: DIR, fs, terminal: vi.fn() });

    log.server('first\nsecond\n');

    const written = lines(fs.files.get(LOG));
    expect(written).toHaveLength(2);
    expect(written[0]).toMatch(/\[server\] first$/);
    expect(written[1]).toMatch(/\[server\] second$/);
  });

  it('appends to a log that is already there', () => {
    const fs = new MemoryFs();
    fs.files.set(LOG, 'yesterday\n');
    const log = shellLog({ toFile: true, dir: DIR, fs, terminal: vi.fn() });

    log.main('today');

    const written = lines(fs.files.get(LOG));
    expect(written[0]).toBe('yesterday');
    expect(written[1]).toMatch(/\[main\] today$/);
  });
});

describe('shellLog — the roll at startup', () => {
  it('renames a log over 5 MB to familyflix.old.log and starts afresh', () => {
    const fs = new MemoryFs();
    fs.files.set(LOG, 'the big one\n');
    fs.sizes.set(LOG, LOG_ROLL_BYTES + 1);

    const log = shellLog({ toFile: true, dir: DIR, fs, terminal: vi.fn() });
    log.main('fresh');

    expect(fs.files.get(OLD)).toBe('the big one\n');
    const written = lines(fs.files.get(LOG));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/\[main\] fresh$/);
  });

  it('leaves a log under 5 MB where it is', () => {
    const fs = new MemoryFs();
    fs.files.set(LOG, 'small\n');
    fs.sizes.set(LOG, LOG_ROLL_BYTES - 1);

    const log = shellLog({ toFile: true, dir: DIR, fs, terminal: vi.fn() });
    log.main('more');

    expect(fs.files.has(OLD)).toBe(false);
    expect(fs.calls.some((call) => call.startsWith('rename'))).toBe(false);
    expect(lines(fs.files.get(LOG))[0]).toBe('small');
  });

  it('replaces the previous familyflix.old.log when it rolls', () => {
    const fs = new MemoryFs();
    fs.files.set(OLD, 'last month\n');
    fs.files.set(LOG, 'this month\n');
    fs.sizes.set(LOG, LOG_ROLL_BYTES + 1);

    shellLog({ toFile: true, dir: DIR, fs, terminal: vi.fn() });

    expect(fs.files.get(OLD)).toBe('this month\n');
  });

  it('rolls nothing when there is no log yet', () => {
    const fs = new MemoryFs();

    const log = shellLog({ toFile: true, dir: DIR, fs, terminal: vi.fn() });
    log.main('first ever');

    expect(fs.files.has(OLD)).toBe(false);
    expect(lines(fs.files.get(LOG))[0]).toMatch(/\[main\] first ever$/);
  });
});

describe('shellLog — terminal mode', () => {
  it('prints the same tagged lines to the terminal', () => {
    const fs = new MemoryFs();
    const printed: string[] = [];
    const log = shellLog({
      toFile: false,
      dir: DIR,
      fs,
      terminal: (text) => printed.push(text),
    });

    log.main('window opened');
    log.server('listening\n');

    const out = lines(printed.join(''));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/\[main\] window opened$/);
    expect(out[1]).toMatch(/\[server\] listening$/);
  });

  it('writes no file, rolls nothing and makes no folder', () => {
    const fs = new MemoryFs();
    fs.files.set(LOG, 'the big one\n');
    fs.sizes.set(LOG, LOG_ROLL_BYTES + 1);

    const log = shellLog({ toFile: false, dir: DIR, fs, terminal: vi.fn() });
    log.main('window opened');
    log.server('listening\n');

    expect(
      fs.calls.filter(
        (call) =>
          call.startsWith('append') ||
          call.startsWith('rename') ||
          call.startsWith('mkdir')
      )
    ).toEqual([]);
    expect(fs.files.get(LOG)).toBe('the big one\n');
    expect(fs.files.has(OLD)).toBe(false);
  });
});
