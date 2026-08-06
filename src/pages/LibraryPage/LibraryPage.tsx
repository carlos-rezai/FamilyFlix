import { GenreRows } from '@/features/library/GenreRows/GenreRows';
import { MainLayout } from '@/layouts/MainLayout/MainLayout';

/**
 * The browse home (`/`) — the screen the family lands on. Composition only:
 * the page chrome from `MainLayout`, the genre rows from the library feature.
 */
export default function LibraryPage() {
  return (
    <MainLayout>
      <GenreRows />
    </MainLayout>
  );
}
