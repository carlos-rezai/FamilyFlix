import { LibrarySection } from '@/features/settings/LibrarySection/LibrarySection';
import { SettingsHeader } from '@/features/settings/SettingsHeader/SettingsHeader';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings` — the **Maintainer**'s hub. Composition only: the **Maintainer
 * surface** around the settings header and the **Library section**, at the
 * 780px measure `page.SettingsPage.dc.html` draws its column at. The Playback,
 * Storage and About sections arrive with the settings-shell initiative, under
 * the Library section, in the same sheet.
 */
export default function SettingsPage() {
  return (
    <MaintainerLayout width={780}>
      <SettingsHeader />
      <LibrarySection />
    </MaintainerLayout>
  );
}
