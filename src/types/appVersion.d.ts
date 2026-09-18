/**
 * The **App version**: `package.json`'s `version`, baked into the bundle by
 * Vite's `define` (`vite.config.mts`) so the About card and the installer can
 * never disagree. Declared once, here, for both build targets and the test
 * runner; it reads `0.0.0` until the packaging initiative sets one.
 */
declare const __APP_VERSION__: string;
