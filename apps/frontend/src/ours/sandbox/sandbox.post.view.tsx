'use client';
// OURS: shows what the Sandbox channel recorded. Always labelled as a sandbox
// post and never presented as published to a real platform.
import { FC } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { SandboxNotice } from '@gitroom/frontend/ours/sandbox/sandbox.notice';

type Recorded = {
  content: string;
  state: string;
  publishDate: string;
  image?: string | { path?: string }[] | null;
  integration?: { name: string; providerIdentifier: string };
};

const toText = (html: string) => {
  if (typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return doc.body.textContent || '';
};

// a post's media: a list of { id, path }, or that list as JSON text
const imagesOf = (image?: Recorded['image']): string[] => {
  try {
    const list = typeof image === 'string' ? JSON.parse(image || '[]') : image || [];
    return Array.isArray(list) ? list.map((m) => m?.path).filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
};

const ukDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(iso));

const useSandboxPost = (id: string) => {
  const fetch = useFetch();
  return useSWR(`sandbox-post-${id}`, async () => {
    const res = await fetch(`/posts/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const first = data?.posts?.[0];
    // only ever show posts that went to a sandbox channel
    return first?.integration?.providerIdentifier === 'sandbox'
      ? (first as Recorded)
      : null;
  });
};

export const SandboxPostView: FC<{ id: string }> = ({ id }) => {
  const { data: post, isLoading, error } = useSandboxPost(id);
  const status = isLoading ? 'loading' : post && !error ? 'ready' : 'missing';

  return (
    <div className="flex-1 bg-newBgColorInner p-[32px] mobile:p-[16px]">
      <div className="max-w-[640px] mx-auto flex flex-col gap-[20px]">
        <h1 className="k-display text-[24px]">Sandbox post</h1>
        <SandboxNotice />
        {status === 'loading' && (
          <div className="text-textItemBlur">Loading the recorded post…</div>
        )}
        {status === 'missing' && (
          <div className="text-textItemBlur">
            We could not find this sandbox post. It may have been deleted.
          </div>
        )}
        {status === 'ready' && post && (
          <div
            className="flex flex-col gap-[12px] rounded-[12px] border border-newBorder p-[20px]"
            data-testid="sandbox-post"
          >
            <div className="flex flex-wrap gap-x-[20px] gap-y-[4px] text-[14px] text-textItemBlur">
              <span>Channel: {post.integration?.name}</span>
              <span>
                {post.state === 'PUBLISHED'
                  ? 'Recorded as sent'
                  : `Status: ${post.state.toLowerCase()}`}
              </span>
              <span>Scheduled for {ukDateTime(post.publishDate)}</span>
            </div>
            <div className="whitespace-pre-wrap text-[16px] leading-[1.5]">
              {toText(post.content)}
            </div>
            {imagesOf(post.image).map((src) => (
              <img
                key={src}
                src={src}
                alt="Image recorded with this sandbox post"
                className="max-w-[360px] w-full rounded-[8px] border border-newBorder"
                data-testid="sandbox-post-image"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
