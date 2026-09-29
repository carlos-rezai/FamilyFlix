import type { ServerMessage, ShellCommand } from '../../src/types/shell';
import { awaitExitOrKill } from '../awaitExitOrKill/awaitExitOrKill';
import type { ServerLaunch } from '../serverLaunch/serverLaunch';

/** How long main waits for the **Shell handshake**'s `ready`. */
export const READY_TIMEOUT_MS = 15_000;

/** The part of Electron's `UtilityProcess` main's hold on the server uses. */
export interface ServerChild {
  on(event: 'message', listener: (message: ServerMessage) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  once(event: 'exit', listener: (code: number) => void): unknown;
  postMessage(message: unknown): void;
  kill(): boolean;
}

export interface ServerHandleWorld {
  /** `utilityProcess.fork()` over the launch, injected. */
  fork: (launch: ServerLaunch) => ServerChild;
  launch: ServerLaunch;
  /** An exit after `ready`: a crash of a running app. */
  onExit: (code: number) => void;
}

export interface ServerHandle {
  /** Fork the server and wait for `ready`, resolving with its bound port. */
  start(): Promise<{ port: number }>;
  /**
   * Send the **Shell handshake**'s `shutdown` and wait for the exit, killing
   * the server at `ms`. The exit asked for is a quit, never `onExit`.
   */
  shutdown(ms: number): Promise<void>;
}

/**
 * Main's hold on the **Server process**. `start()` rejects on `fatal` with the
 * server's own message, at the 15 s timeout, and when the process exits before
 * `ready`; an exit after `ready` goes to `onExit`.
 */
export function serverHandle({
  fork,
  launch,
  onExit,
}: ServerHandleWorld): ServerHandle {
  let child: ServerChild | undefined;
  let stopping = false;
  let exited = false;

  return {
    shutdown(ms) {
      if (!child || exited) return Promise.resolve();
      stopping = true;
      const waited = awaitExitOrKill(child, ms);
      child.postMessage({ type: 'shutdown' } satisfies ShellCommand);
      return waited;
    },
    start() {
      return new Promise((resolve, reject) => {
        const forked = fork(launch);
        child = forked;
        let ready = false;
        let settled = false;

        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        };

        const timer = setTimeout(
          () =>
            fail(
              new Error(
                `The server did not start within ${READY_TIMEOUT_MS / 1000} s.`
              )
            ),
          READY_TIMEOUT_MS
        );

        forked.on('message', (message: ServerMessage) => {
          if (settled) return;
          if (message.type === 'fatal') {
            fail(new Error(message.message));
            return;
          }
          settled = true;
          ready = true;
          clearTimeout(timer);
          resolve({ port: message.port });
        });

        forked.on('exit', (code: number) => {
          exited = true;
          if (stopping) return;
          if (ready) {
            onExit(code);
            return;
          }
          fail(new Error(`The server exited with code ${code} before ready.`));
        });
      });
    },
  };
}
