import { Outlet } from 'react-router-dom';

import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';

import { Frame } from './ContentFrame.styles';

/**
 * The **Content frame**: the layout route's element around every route but
 * the player's two. It reads **Ultrawide margins** off the app-level provider
 * and caps what the outlet renders at the **Content measure** only while that
 * is `true` — so no layout, page or feature learns the preference exists, and
 * a new screen is framed by default. The route table that decides which
 * routes are framed is proven through `App` in `App.contentFrame.test.tsx`.
 */
export function ContentFrame() {
  const { ultrawideMargins } = useDisplayPreference();

  return (
    <Frame $capped={ultrawideMargins === true}>
      <Outlet />
    </Frame>
  );
}
