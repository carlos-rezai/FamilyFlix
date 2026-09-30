import { join, resolve } from 'node:path';
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from 'express';

/**
 * The Content-Security-Policy the served renderer runs under. TMDB's image
 * host is allowed so the Enrichment review's candidate posters draw. It is
 * sent on the renderer only, never on `/api` — which is the whole rule: the
 * policy of Express's own not-found page, `default-src 'none'`, is Express's,
 * stricter, and left as it is.
 */
export const RENDERER_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https://image.tmdb.org; media-src 'self' blob:; " +
  "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'";

function isApi(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

/**
 * The built renderer at `rendererPath` under the CSP: its files as they are,
 * and `index.html` for any other GET, so a reload on a deep route stays there
 * (**One origin**). Nothing under `/api` is ever answered here — it is passed
 * on before the policy is set, so the router can sit ahead of the API as well
 * as behind it.
 */
export function rendererRouter(rendererPath: string): Router {
  const root = resolve(rendererPath);
  const router = express.Router();

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (isApi(req.path)) {
      next('router');
      return;
    }
    res.setHeader('Content-Security-Policy', RENDERER_CSP);
    next();
  });
  router.use(express.static(root, { index: 'index.html' }));
  router.get(/.*/, (_req, res) => {
    res.sendFile(join(root, 'index.html'));
  });

  return router;
}

/**
 * Mount the renderer when `FAMILYFLIX_RENDERER_PATH` names one. When it is
 * unset nothing is mounted — Vite serves the renderer, and `npm run dev` is
 * exactly what it was before the shell (Q15).
 */
export function mountRenderer(
  app: Express,
  rendererPath: string | undefined
): void {
  if (rendererPath === undefined || rendererPath === '') return;
  app.use(rendererRouter(rendererPath));
}
