import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

import type { ServerMessage } from '../../../src/types/shell';
import type { ServerChild } from '../../serverHandle/serverHandle';

/**
 * A **Server process** child that is never forked: the `UtilityProcess` main
 * holds, standing in for Electron's. `postMessage` and `kill` are recorded;
 * `post(message)` delivers a **Shell handshake** message to main with the
 * message itself as the payload, and `exit(code)` emits the exit with its
 * code, the way Electron's does.
 *
 * It is a test double, so it lives in `electron/test-support/`, the shell's
 * rung of `server/src/test-support/`'s rule: never imported by shipping code —
 * `tsconfig.electron.json` excludes the folder, so the typecheck enforces it.
 */
export class FakeServerChild extends EventEmitter implements ServerChild {
  readonly postMessage = vi.fn<(message: unknown) => void>();
  readonly kill = vi.fn(() => true);

  post(message: ServerMessage): void {
    this.emit('message', message);
  }

  exit(code: number): void {
    this.emit('exit', code);
  }
}
