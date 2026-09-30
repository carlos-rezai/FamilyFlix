import type { NextFunction, Request, Response } from 'express';

/** Vite's dev origin, trusted when `FAMILYFLIX_TRUSTED_HOSTS` is unset. */
export const DEFAULT_TRUSTED_HOSTS = 'localhost:4200';

export interface LoopbackGuard {
  (req: Request, res: Response, next: NextFunction): void;
  /** Tell the guard the port the server bound, once `listen` has resolved. */
  bind(port: number): void;
}

/**
 * The **Loopback guard**: middleware mounted in front of everything, answering
 * `403` when `Host` is not a **Trusted host** — a DNS-rebinding name included —
 * or when an `Origin` is present and is not a trusted one. The trusted hosts
 * are `127.0.0.1:<bound>`, `localhost:<bound>` and whatever `trustedHosts`
 * (`FAMILYFLIX_TRUSTED_HOSTS`) lists, comma-separated: `localhost:4200` when
 * unset, nothing when empty. A request with no `Origin` from a trusted `Host`
 * passes, which keeps `<video>`, `<img>` and the Vite proxy working.
 */
export function loopbackGuard(trustedHosts: string | undefined): LoopbackGuard {
  const listed = (trustedHosts ?? DEFAULT_TRUSTED_HOSTS)
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '');
  let trusted = new Set(listed);

  const guard = ((req: Request, res: Response, next: NextFunction) => {
    const host = (req.headers.host ?? '').toLowerCase();
    const origin = req.headers.origin;
    const originTrusted =
      origin === undefined ||
      [...trusted].some((h) => origin.toLowerCase() === `http://${h}`);
    if (!trusted.has(host) || !originTrusted) {
      res.status(403).end();
      return;
    }
    next();
  }) as LoopbackGuard;

  guard.bind = (port: number) => {
    trusted = new Set([...listed, `127.0.0.1:${port}`, `localhost:${port}`]);
  };

  return guard;
}
