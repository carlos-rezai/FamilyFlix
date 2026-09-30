import { join } from 'node:path';

/**
 * The **Shell log**. In the **Installed app**, main's output and the server's
 * stdout/stderr append to `logs\familyflix.log`, each line tagged `[main]` or
 * `[server]`; at startup a file over 5 MB is renamed to `familyflix.old.log`,
 * replacing the previous one. An **Unpackaged run** prints the same tagged
 * lines to the terminal and touches no file.
 */

/** The size over which the log is rolled at startup. */
export const LOG_ROLL_BYTES = 5 * 1024 * 1024;

const LOG_FILE = 'familyflix.log';
const OLD_LOG_FILE = 'familyflix.old.log';

/** The part of the file system the log uses, injected. */
export interface LogFileSystem {
  /** The file's size in bytes, or `undefined` when there is none. */
  size(path: string): number | undefined;
  /** Rename, replacing `to` when it exists. */
  rename(from: string, to: string): void;
  append(path: string, text: string): void;
  /** Make the folder, and its parents, when missing. */
  mkdir(dir: string): void;
}

export interface ShellLogOptions {
  /** The **Installed app** writes the file; an **Unpackaged run** does not. */
  toFile: boolean;
  /** The `logs` folder under `userData`. */
  dir: string;
  fs: LogFileSystem;
  /** Where terminal mode prints. */
  terminal: (text: string) => void;
}

export interface ShellLog {
  /** A line, or several, from the main process. */
  main(text: string): void;
  /** A chunk of the server's stdout or stderr. */
  server(text: string): void;
}

function tagged(tag: string, text: string): string {
  const stamp = new Date().toISOString();
  return text
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => `${stamp} [${tag}] ${line}\n`)
    .join('');
}

export function shellLog({
  toFile,
  dir,
  fs,
  terminal,
}: ShellLogOptions): ShellLog {
  const file = join(dir, LOG_FILE);

  if (toFile) {
    fs.mkdir(dir);
    const size = fs.size(file);
    if (size !== undefined && size > LOG_ROLL_BYTES) {
      fs.rename(file, join(dir, OLD_LOG_FILE));
    }
  }

  const write = (tag: string, text: string) => {
    const lines = tagged(tag, text);
    if (lines.length === 0) return;
    if (toFile) fs.append(file, lines);
    else terminal(lines);
  };

  return {
    main: (text) => write('main', text),
    server: (text) => write('server', text),
  };
}
