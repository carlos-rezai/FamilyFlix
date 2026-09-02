import express from 'express';

import { createSqliteStorage } from './library';
import { createPlayback } from './playback/createPlayback/createPlayback';
import { ffmpegBinary } from './playback/ffmpegBinary/ffmpegBinary';
import { ffmpegComponent } from './playback/ffmpegComponent/ffmpegComponent';
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

const storage = createSqliteStorage(DB_PATH);

/**
 * The **Playback component**, resolved once at startup:
 * `FAMILYFLIX_FFMPEG_PATH`, then `PATH`, then **absent**. Absent is a state
 * rather than an error — the app starts, the library browses, and MP4s still
 * direct-play on a machine with no FFmpeg on it.
 */
const binaries = ffmpegBinary(process.env);
const component = binaries === null ? null : ffmpegComponent(binaries);

const app = express();
app.use(
  '/api',
  createApiRouter(storage, MEDIA_PATH, createPlayback(MEDIA_PATH, component))
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
