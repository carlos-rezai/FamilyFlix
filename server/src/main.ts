import type { Server } from 'node:http';
import express from 'express';

import { createEnrichment } from './enrichment/createEnrichment/createEnrichment';
import { createTmdbClient } from './enrichment/tmdbClient/tmdbClient';
import { createImporter } from './import-export/createImporter/createImporter';
import { createSqliteStorage } from './library';
import { createMedia } from './media/createMedia/createMedia';
import { createComponentSlot } from './playback/componentSlot/componentSlot';
import { createPlayback } from './playback/createPlayback/createPlayback';
import { createApiRouter } from './routes';
import { listen } from './shell/listen/listen';
import {
  orderedShutdown,
  shutdownOnSignals,
} from './shell/orderedShutdown/orderedShutdown';
import {
  parentPortOf,
  shellHandshake,
} from './shell/shellHandshake/shellHandshake';

/**
 * The backend composition root: read the environment, open the library, mount
 * the API, listen on the loopback — and, under the **Desktop shell**, say
 * so. Every path is configurable because the packaged app runs against the
 * Electron user-data directory, while `npm run dev:server` runs against the
 * repo-local defaults.
 */
const PORT = Number(process.env.PORT ?? 3001);
const DB_PATH = process.env.FAMILYFLIX_DB_PATH ?? './familyflix.db';
const MEDIA_PATH = process.env.FAMILYFLIX_MEDIA_PATH ?? './media';
const COMPONENT_PATH =
  process.env.FAMILYFLIX_COMPONENT_PATH ?? './playback-component';

/**
 * Open the library, mount the API and listen on the loopback. Run inside the
 * **Shell handshake**, so a failure here is what the **Desktop shell** is told.
 */
interface Started {
  server: Server;
  /** The **Ordered shutdown** over what this startup opened. */
  shutdown: () => Promise<void>;
}

async function start(): Promise<Started> {
  const storage = createSqliteStorage(DB_PATH);

  /**
   * The **Component slot**: the writable directory an **Uploaded component**
   * lives in, read ahead of `FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`. It
   * resolves the live **Playback component** — `ffmpegBinary` and
   * `ffmpegComponent` are called by the slot rather than here — and clears
   * what a crashed upload left behind.
   *
   * Absent is a state rather than an error: a machine with no FFmpeg on it at
   * all still starts, still browses the library, and still direct-plays its
   * MP4s.
   */
  const slot = createComponentSlot(COMPONENT_PATH, process.env);

  const playback = createPlayback(MEDIA_PATH, slot);
  const media = createMedia(MEDIA_PATH);

  // The import domain over the same library and managed directory the routes
  // write through, so an imported film is a hand-added one to every read in
  // the app.
  const importer = createImporter({ storage, media, playback });
  // The one domain that goes online, over the global `fetch`.
  const enrichment = createEnrichment({
    storage,
    client: createTmdbClient(fetch),
    media,
  });

  const app = express();
  app.use(
    '/api',
    createApiRouter(storage, MEDIA_PATH, playback, media, importer, enrichment)
  );

  let server: Server;
  try {
    server = await listen(app, PORT);
  } catch (error) {
    storage.close();
    throw error;
  }

  let stopping: Promise<void> | undefined;
  const shutdown = () => {
    stopping ??= orderedShutdown({
      importer,
      enrichment,
      server,
      closeDatabase: () => storage.close(),
      exit: (code) => process.exit(code),
    });
    return stopping;
  };
  return { server, shutdown };
}

/**
 * The **Ordered shutdown**, once the server is up: main's `shutdown` command
 * under the **Desktop shell**, `SIGINT`/`SIGTERM` standalone — one function.
 * A startup failure is left to reject unhandled, which ends the process the
 * way a throw here always did.
 */
let shutdown = (): Promise<void> => Promise.resolve();

shellHandshake(
  parentPortOf(process),
  async () => {
    const started = await start();
    shutdown = started.shutdown;
    return started.server;
  },
  () => shutdown()
).then(() => shutdownOnSignals(process, () => shutdown()));
