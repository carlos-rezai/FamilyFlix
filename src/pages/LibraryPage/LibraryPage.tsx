import { HomeRows } from '@/features/library/HomeRows/HomeRows';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';

/**
 * The browse home (`/`) — the screen the family lands on. Composition only:
 * the page chrome from `MainLayout`, the home rows from the library feature.
 */
export default function LibraryPage() {
  return (
    <MainLayout>
      <HomeRows />
    </MainLayout>
  );
}
