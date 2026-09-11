import { SettingsHeader } from '@/features/settings/SettingsHeader/SettingsHeader';
import { MaintainerLayout } from '@/layouts/MaintainerLayout/MaintainerLayout';

/**
 * `/settings` — the **Maintainer**'s hub. Composition only: the **Maintainer
 * surface** around the settings header, at the 780px measure
 * `page.SettingsPage.dc.html` draws its column at. The grouped Library /
 * Playback / Storage / About sections arrive with the settings-shell
 * initiative, under the header, in the same sheet.
 */
export default function SettingsPage() {
  return (
    <MaintainerLayout width={780}>
      <SettingsHeader />
    </MaintainerLayout>
  );
}
