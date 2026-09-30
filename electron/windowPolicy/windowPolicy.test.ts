// @vitest-environment node
//
// Issue #223 — the window's rules. The window can only ever be FamilyFlix:
// `isAppUrl` keeps navigation on the app's own origin, `openExternalAllowed`
// lets only `https:` out to the default browser, and `permissionAllowed`
// grants `fullscreen` and nothing else. Pure, so main only wires them to
// `will-navigate`, `setWindowOpenHandler` and the permission handler.

import { describe, expect, it } from 'vitest';

import {
  isAppUrl,
  openExternalAllowed,
  permissionAllowed,
} from './windowPolicy';

/** The origin the window was pointed at — what `rendererUrl` returns. */
const APP = 'http://127.0.0.1:41720/';

describe('isAppUrl', () => {
  it('holds the app origin itself, and any route under it', () => {
    expect(isAppUrl('http://127.0.0.1:41720/', APP)).toBe(true);
    expect(isAppUrl('http://127.0.0.1:41720/movie/12?tab=series', APP)).toBe(
      true
    );
  });

  it('refuses another port on the same host', () => {
    expect(isAppUrl('http://127.0.0.1:41721/', APP)).toBe(false);
  });

  it('refuses another host on the same port', () => {
    expect(isAppUrl('http://localhost:41720/', APP)).toBe(false);
    expect(isAppUrl('http://evil.example:41720/', APP)).toBe(false);
  });

  it('refuses another scheme', () => {
    expect(isAppUrl('https://127.0.0.1:41720/', APP)).toBe(false);
    expect(isAppUrl('file:///C:/Windows/System32/', APP)).toBe(false);
  });

  it('refuses what does not parse as a URL', () => {
    expect(isAppUrl('not a url', APP)).toBe(false);
  });
});

describe('openExternalAllowed', () => {
  it('lets an https link out to the default browser', () => {
    expect(openExternalAllowed('https://www.themoviedb.org/movie/603')).toBe(
      true
    );
  });

  it('drops http, file and javascript', () => {
    expect(openExternalAllowed('http://www.themoviedb.org/')).toBe(false);
    expect(openExternalAllowed('file:///C:/Users/')).toBe(false);
    expect(openExternalAllowed('javascript:alert(1)')).toBe(false);
  });

  it('drops what does not parse as a URL', () => {
    expect(openExternalAllowed('www.themoviedb.org')).toBe(false);
  });
});

describe('permissionAllowed', () => {
  it('grants fullscreen', () => {
    expect(permissionAllowed('fullscreen')).toBe(true);
  });

  it('refuses every other permission', () => {
    for (const permission of [
      'media',
      'notifications',
      'geolocation',
      'clipboard-read',
      'openExternal',
      'pointerLock',
      '',
    ]) {
      expect(permissionAllowed(permission)).toBe(false);
    }
  });
});
