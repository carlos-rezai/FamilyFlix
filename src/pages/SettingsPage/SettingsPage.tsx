import { LibrarySection } from '@/features/settings/LibrarySection/LibrarySection';
import { PlaybackSection } from '@/features/settings/PlaybackSection/PlaybackSection';
import { StorageSection } from '@/features/settings/StorageSection/StorageSection';
import { SettingsHeader } from '@/features/settings/SettingsHeader/SettingsHeader';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings` — the **Maintainer**'s hub. Composition only: the **Maintainer
 * surface** around the settings header, the **Library section**, the
 * **Playback section** and the **Storage section**, at the 780px measure
 * `page.SettingsPage.dc.html` draws its column at — LIBRARY, PLAYBACK, then
 * STORAGE. The About section arrives with the last phase of the settings-hub
 * initiative, under these, in the same sheet.
 */
export default function SettingsPage() {
  return (
    <MaintainerLayout width={780}>
      <SettingsHeader />
      <LibrarySection />
      <PlaybackSection />
      <StorageSection />
    </MaintainerLayout>
  );
}
