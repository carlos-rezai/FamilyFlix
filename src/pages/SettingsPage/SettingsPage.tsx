import { AboutSection } from '@/features/settings/AboutSection/AboutSection';
import { DisplaySection } from '@/features/settings/DisplaySection/DisplaySection';
import { LibrarySection } from '@/features/settings/LibrarySection/LibrarySection';
import { NetworkSection } from '@/features/settings/NetworkSection/NetworkSection';
import { PlaybackSection } from '@/features/settings/PlaybackSection/PlaybackSection';
import { StorageSection } from '@/features/settings/StorageSection/StorageSection';
import { SettingsHeader } from '@/features/settings/SettingsHeader/SettingsHeader';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings` — the **Maintainer**'s hub. Composition only: the **Maintainer
 * surface** around the settings header, the **Library section**, the
 * **Playback section**, the **Display section**, the **Network section**, the
 * **Storage section** and the **About section**, at the 780px measure
 * `page.SettingsPage.dc.html` draws its column at — LIBRARY, PLAYBACK,
 * DISPLAY, NETWORK, STORAGE, then ABOUT: the whole page the prototype draws,
 * and nothing else.
 */
export default function SettingsPage() {
  return (
    <MaintainerLayout width={780}>
      <SettingsHeader />
      <LibrarySection />
      <PlaybackSection />
      <DisplaySection />
      <NetworkSection />
      <StorageSection />
      <AboutSection />
    </MaintainerLayout>
  );
}
