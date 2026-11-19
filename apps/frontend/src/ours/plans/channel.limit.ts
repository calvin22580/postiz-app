'use client';
// OURS: when connecting a channel isn't allowed (over the channel limit, or the
// plan has ended), the backend answers 403 with planLimit: 'channels'
// (PlanService.assertCanAddChannel).
// Upstream's connect buttons only expect a connection link or a 402, so
// without this they followed an empty link to /undefined. Called with one
// line from upstream's afterRequest (layout.context.tsx), like its own 402.
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

// true when the response was the channel limit and the owner has been told
export const showChannelLimit = async (response: Response) => {
  // a connection link's visitor may not be the owner and can't change the
  // plan: that page shows its own failure (connect.link.tsx)
  if (response.status !== 403 || response.url.includes('/integrations/public/')) {
    return false;
  }
  const { message, planLimit } = await response
    .clone()
    .json()
    .catch(() => ({}));
  if (planLimit !== 'channels' || !message) {
    return false;
  }
  if (await deleteDialog(message, 'Go to Plan and usage', 'Can’t connect another channel', 'Not now')) {
    window.location.href = '/plan';
  }
  return true;
};
