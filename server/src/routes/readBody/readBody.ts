import type { Readable } from 'node:stream';

import busboy from 'busboy';
import type { Request } from 'express';

/**
 * What a route is handed when a file part arrives: its field name, the name the
 * client gave the file, the bytes themselves, and **the fields that arrived
 * before it**.
 *
 * The last of those is the awkward one, and it is deliberately not hidden. A
 * `FormData` carries its parts in the order the client appended them, and
 * `busboy` will not reach the parts after a file until that file has been
 * consumed — so a route that needs the title to decide where the bytes go can
 * only ever be shown the title if it has already arrived. What to do about a
 * body that named its film after it sent it is the route's problem to solve,
 * and it can only solve it if the parser is honest about which fields it has.
 */
export type OnFilePart = (
  name: string,
  filename: string,
  part: Readable,
  before: Record<string, string[]>
) => Promise<void>;

/**
 * Read a `multipart/form-data` body: answer with its fields by name, having
 * handed every file part to {@link OnFilePart} as it arrived.
 *
 * The one place in this file that reads a request body itself rather than
 * through `express.json()`, because this is the one request shape that is not
 * JSON. `busboy` parses the stream as it arrives, which is the whole reason it
 * is here rather than `multer`: the file parts are video files, and a 12 GB
 * body must never be buffered to hand a route its `title`.
 *
 * **Every part is consumed, handled or not.** `busboy` never reaches `close`
 * while a part nobody listens to is still pending, so a handler that rejects
 * drains what is left of its part before the rejection is carried out — a hung
 * request is a worse answer than a failed one.
 *
 * A body that is not multipart at all rejects: `busboy` throws on the headers
 * before a byte is read, and the promise carries that out.
 *
 * **Every value of a repeated name is kept, in the order the parts arrived.**
 * That is what a multipart body actually carries, and the genre chips are the
 * first field that is genuinely a list: a set has always travelled as one part
 * per entry under one name, the way an HTML checkbox group sends it. A field
 * that is sent once is simply a list of one — {@link onlyField} is how the
 * single-valued ones are read back.
 */
export function readBody(
  req: Request,
  onFile: OnFilePart
): Promise<Record<string, string[]>> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string[]> = {};
    const handled: Promise<void>[] = [];
    const parser = busboy({ headers: req.headers });

    parser.on('field', (name, value) => {
      (fields[name] ??= []).push(value);
    });
    parser.on('file', (name, part, info) => {
      const write = onFile(name, info.filename, part, fields).catch(
        (error: unknown) => {
          part.resume();
          throw error;
        }
      );

      // A rejection is only ever *answered* at `close`, which is a later turn
      // of the event loop — long enough for Node to call this promise unhandled
      // and take the process down with it, which for a save that failed on a
      // full disk would be the whole server rather than one 400. The second
      // reaction is what says somebody is listening; the rejection `Promise.all`
      // carries out below is still this one's own.
      //
      // Found by this unit's own first test, in the refactor round that gave it
      // one: through the router the throw was always somebody's rejected save,
      // and the crash it also was had nowhere to be seen.
      write.catch(() => undefined);

      handled.push(write);
    });
    // `close` says the body was parsed, not that it was stored: the last part's
    // write is still in flight, and a row written before its bytes were on disk
    // would point at a file that is not there yet.
    parser.on('close', () => {
      Promise.all(handled).then(() => resolve(fields), reject);
    });
    parser.on('error', reject);

    req.pipe(parser);
  });
}
