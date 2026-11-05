// @vitest-environment node
//
// Linux build, issue #519: "a copied film under ~/.config cannot direct-play".
//
// On Linux the **Managed media directory** is `~/.config/FamilyFlix/media`.
// The direct path serves a copied film with `res.sendFile` on an absolute path,
// and `send` refuses, as a 404, any path with a segment that starts with a dot
// unless it is told dotfiles are allowed. The path comes from the database
// through `mediaFilePath`, never from the URL, so allowing them opens nothing.
//
// Over a real listener, a real `:memory:` library and a media directory whose
// absolute path holds a `.config` segment, the way the packaged app's does.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Movie } from '@/types';

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

const VIDEO_BYTES = Buffer.from(
  'FAMILYFLIX fixture video bytes, long enough to take a slice out of.'
);

/** The API over a media directory at `<sandbox>/.config/FamilyFlix/media`. */
function apiUnderDotSegment(): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const media = join(
    sandboxRoot('familyflix-dot-'),
    '.config',
    'FamilyFlix',
    'media'
  );
  mkdirSync(media, { recursive: true });

  const playback = createPlayback(media, fixedSlot(null), () => null);
  const mediaDomain = createMedia(media);
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
      })
    )
  );

  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, media };
}

/** A copied film: its MP4 under its Movie folder, its Stored path relative. */
function addCopiedFilm(storage: LibraryStorage, media: string): Movie {
  const relativePath = 'northwind-2018/northwind.mp4';
  mkdirSync(join(media, 'northwind-2018'), { recursive: true });
  writeFileSync(join(media, relativePath), VIDEO_BYTES);
  return storage.addMovie({
    title: 'Northwind',
    videoPath: relativePath,
    genres: ['Action'],
  });
}

const streamUrl = (baseUrl: string, id: string) =>
  `${baseUrl}/api/movies/${encodeURIComponent(id)}/stream`;

describe('GET /api/movies/:id/stream — a media directory under a dot segment', () => {
  it('direct-plays a copied film: 200 and the file’s bytes', async () => {
    const { storage, baseUrl, media } = apiUnderDotSegment();
    const film = addCopiedFilm(storage, media);

    const response = await fetch(streamUrl(baseUrl, film.id));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(VIDEO_BYTES);
  });

  it('still answers a Range request with the slice', async () => {
    const { storage, baseUrl, media } = apiUnderDotSegment();
    const film = addCopiedFilm(storage, media);

    const response = await fetch(streamUrl(baseUrl, film.id), {
      headers: { Range: 'bytes=10-19' },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe(
      `bytes 10-19/${VIDEO_BYTES.length}`
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      VIDEO_BYTES.subarray(10, 20)
    );
  });
});
