/**
 * The App User Model ID Windows groups FamilyFlix's window and a pinned
 * shortcut under, so the pin keeps the **App mark** rather than Electron's.
 * Main sets it before any window exists.
 */
export const APP_USER_MODEL_ID = 'io.github.carlosrezai.familyflix';

/**
 * FamilyFlix in one sentence. The AppImage's own entry carries it as
 * `linux.synopsis` in `builderConfig.json`, and FamilyFlix's **Menu entry**
 * as its `Comment`; the packaging guard holds the two to this one spelling.
 */
export const APP_SYNOPSIS =
  'A browsable library and player for the family movie folder';
