import express from 'express';

import { createEnrichment } from './enrichment/createEnrichment/createEnrichment';
import { createTmdbClient } from './enrichment/tmdbClient/tmdbClient';
import { createImporter } from './import-export/createImporter/createImporter';
import { createSqliteStorage } from './library';
import { createMedia } from './media/createMedia/createMedia';
import { createComponentSlot } from './playback/componentSlot/componentSlot';
import { createPlayback } from './playback/createPlayback/createPlayback';
import { createApiRouter } from './routes';

/**
 * The backend composition root: read the environment, open the library, mount
 * the API, listen. Every path is configurable because the packaged app runs
 * against the Electron user-data directory, while `npm run dev:server` runs
 * against the repo-local defaults.
 */
const PORT = Number(process.env.PORT ?? 3001);
const DB_PATH = process.env.FAMILYFLIX_DB_PATH ?? './familyflix.db';
const MEDIA_PATH = process.env.FAMILYFLIX_MEDIA_PATH ?? './media';
const COMPONENT_PATH =
  process.env.FAMILYFLIX_COMPONENT_PATH ?? './playback-component';

const storage = createSqliteStorage(DB_PATH);

/**
 * The **Component slot**: the writable directory an **Uploaded component**
 * lives in, read ahead of `FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`. It
 * resolves the live **Playback component** — `ffmpegBinary` and
 * `ffmpegComponent` are called by the slot rather than here — and clears what
 * a crashed upload left behind.
 *
 * Absent is a state rather than an error: a machine with no FFmpeg on it at
 * all still starts, still browses the library, and still direct-plays its
 * MP4s.
 */
const slot = createComponentSlot(COMPONENT_PATH, process.env);

const playback = createPlayback(MEDIA_PATH, slot);
const media = createMedia(MEDIA_PATH);

const app = express();
app.use(
  '/api',
  createApiRouter(
    storage,
    MEDIA_PATH,
    playback,
    media,
    // The import domain over the same library and managed directory the
    // routes write through, so an imported film is a hand-added one to every
    // read in the app.
    createImporter({ storage, media, playback }),
    // The one domain that goes online, over the global `fetch`.
    createEnrichment({ storage, client: createTmdbClient(fetch) })
  )
);

const server = app.listen(PORT);

/** Close the listener and the database so no WAL files are left mid-write. */
function shutdown(): void {
  server.close(() => {
    storage.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
