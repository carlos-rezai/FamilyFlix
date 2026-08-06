import { MainLayout } from '@/layouts/MainLayout/MainLayout';

/**
 * `/settings` — a placeholder giving the header's gear a real destination. The
 * grouped Library / Playback / Storage / About sections arrive with the
 * settings feature and slot in behind this same URL.
 */
export default function SettingsPage() {
  return (
    <MainLayout>
      <h1>Settings</h1>
      <p>The settings screen lands here.</p>
    </MainLayout>
  );
}
