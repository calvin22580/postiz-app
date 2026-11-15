'use client';
// OURS: post editor settings for the Sandbox channel. Registered in upstream's
// components/new-launch/providers/show.all.providers.tsx by one marked line.
import { FC } from 'react';
import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import { GeneralPreviewComponent } from '@gitroom/frontend/components/launches/general.preview.component';
import { SandboxNotice } from '@gitroom/frontend/ours/sandbox/sandbox.notice';

const SandboxPreview: FC<{ maximumCharacters?: number }> = (props) => (
  <div className="flex flex-col gap-[12px]">
    <SandboxNotice />
    <GeneralPreviewComponent {...(props as any)} />
  </div>
);

export default withProvider({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: null,
  CustomPreviewComponent: SandboxPreview,
  dto: undefined,
  maximumCharacters: 5000,
});
