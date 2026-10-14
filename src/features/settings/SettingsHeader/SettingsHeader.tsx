import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { PageHeader } from '@/components';

/**
 * The header of the **Maintainer**'s hub, from `page.SettingsPage.dc.html`:
 * the back pill, the heading, and the line under them.
 *
 * It once carried ＋ Add a title at the row's end too; that was the Library
 * group's first row twice over, one screen apart, so the row is the one door
 * to the **Movie form** now. The header gear is the only way to Settings, and
 * nothing the **Family** sees on the browse home leads to either.
 *
 * An organism rather than the page's own markup: a heading and a navigation
 * are content and a decision, and a page is composition only. Two files, no
 * styles — it draws nothing `PageHeader` does not.
 */
export function SettingsHeader() {
  const goBack = useGoBack();

  return (
    <PageHeader
      onBack={goBack}
      heading="Settings"
      lede="Manage your library, playback, and storage."
    />
  );
}
