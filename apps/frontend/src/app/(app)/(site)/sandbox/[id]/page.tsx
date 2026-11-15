// OURS: where a Sandbox channel's "open post" link lands. New route, no
// upstream files changed.
import { Metadata } from 'next';
import { brand } from '@gitroom/frontend/ours/brand/brand';
import { SandboxPostView } from '@gitroom/frontend/ours/sandbox/sandbox.post.view';

export const metadata: Metadata = {
  title: `${brand.name} Sandbox post`,
  description: '',
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SandboxPostView id={id} />;
}
