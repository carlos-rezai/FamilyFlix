import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { ServerMessage, ShellCommand } from '../../../../src/types/shell';

/**
 * The part of Electron's `process.parentPort` the server uses: post a
 * **Shell handshake** message to main, and hear main's commands.
 */
export interface ShellParentPort {
  postMessage(message: ServerMessage): void;
  on(
    event: 'message',
    listener: (event: { data: ShellCommand }) => void
  ): unknown;
}

/**
 * The parent port main forked this process with, or `undefined` when the
 * server was started any other way (`npm run dev:server`, the tests).
 */
export function parentPortOf(
  running: NodeJS.Process
): ShellParentPort | undefined {
  const port: unknown = Reflect.get(running, 'parentPort');
  return port === undefined || port === null
    ? undefined
    : (port as ShellParentPort);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The server's half of the **Shell handshake**: run `startup` (open the
 * library, listen) and tell the **Desktop shell** how it went — `ready` with
 * the port the listener actually bound, or `fatal` with the message when the
 * startup throws. The failure is still thrown afterwards, so the process ends
 * the way it always did.
 *
 * Without a parent port there is no shell to tell, and it is inert.
 */
export async function shellHandshake(
  parentPort: ShellParentPort | undefined,
  startup: () => Server | Promise<Server>
): Promise<Server> {
  let server: Server;
  try {
    server = await startup();
  } catch (error) {
    parentPort?.postMessage({ type: 'fatal', message: messageOf(error) });
    throw error;
  }

  const { port } = server.address() as AddressInfo;
  parentPort?.postMessage({ type: 'ready', port });
  return server;
}
