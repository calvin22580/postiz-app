'use client';
// OURS: the onboarding channel list loads once and is kept open across the
// connect round trip, so a channel connected without leaving the app (the
// Sandbox form) didn't show until a page refresh. Reload the list whenever
// the app comes back with ?added=<channel>.
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

export const useRefreshOnChannelAdded = (refresh: () => unknown) => {
  const added = useSearchParams().get('added');
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (added) latest.current();
  }, [added]);
};
