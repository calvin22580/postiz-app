'use client';
// OURS: the blog post card on the review screen (blog posts B1). The owner
// can say what's new, have a post written from their profile, then approve,
// edit, rewrite or reject it. An approved post is copied into their website
// (formatted, as HTML or as plain text); nothing is published from here yet.
// Hidden unless blog posts are switched on.
import { FC, useEffect, useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import { PlanMessage } from '@gitroom/frontend/ours/plans/plan.message';
import { PrimarySmallButton, SecondaryButton } from '@gitroom/frontend/ours/captions/caption.card';
import { BlogOverview, BlogPost, useBlogPosts } from '@gitroom/frontend/ours/blog/blog.hooks';
import { REJECT_REASONS } from '@gitroom/nestjs-libraries/ours/memory/brand.signal';
import { blogBlocks, blogHtml, blogPlainText } from '@gitroom/nestjs-libraries/ours/blog/blog.text';

type Ready = Extract<BlogOverview, { on: true }>;

const NOTE_MAX = 300;
// how much of a waiting post shows before "Read the whole post"
const PREVIEW_BLOCKS = 3;

const day = (date: string) => newDayjs(date).format('DD/MM/YYYY');

const describeDetails = (details: string[]) => {
  const named = details.map((d) => (d === 'price or percentage' ? 'a price or percentage' : `“${d}”`));
  return named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}` : named[0];
};

const Notice: FC<{ children: React.ReactNode; tone?: 'plain' | 'demo' | 'check'; testId?: string }> = ({
  children,
  tone = 'plain',
  testId,
}) => (
  <div
    data-testid={testId}
    className={clsx(
      'rounded-[10px] border px-[14px] py-[10px] text-[14px] leading-[1.6]',
      tone === 'plain' ? 'border-newBorder bg-newBgColorInner' : 'border-amber-500/40 bg-amber-500/10'
    )}
  >
    {children}
  </div>
);

// The post as it will read on the website. Built from text only: nothing in
// the post becomes HTML here.
const PostBody: FC<{ body: string; limit?: number }> = ({ body, limit }) => {
  const blocks = blogBlocks(body);
  const shown = limit ? blocks.slice(0, limit) : blocks;
  // a preview doesn't end on a heading with nothing under it
  if (limit && shown.length > 1 && shown[shown.length - 1].type === 'heading') {
    shown.pop();
  }
  return (
    <div className="flex flex-col gap-[12px] text-[15px] leading-[1.7]" data-testid="blog-body">
      {shown.map((b, i) =>
        b.type === 'heading' ? (
          <h4 key={i} className="text-[16px] font-[600] mt-[6px]">
            {b.text}
          </h4>
        ) : b.type === 'list' ? (
          <ul key={i} className="list-disc pl-[22px] flex flex-col gap-[4px]">
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        )
      )}
    </div>
  );
};

// Copies with a short "Copied" confirmation. Formatted copies carry both HTML
// and plain text, so a website editor keeps the headings and lists.
const CopyButton: FC<{ label: string; html?: string; text: string; testId: string }> = ({ label, html, text, testId }) => {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setState('idle'), 2500);
    return () => clearTimeout(t);
  }, [state]);
  const copy = async () => {
    try {
      if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  return (
    <SecondaryButton testId={testId} onClick={copy}>
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy' : label}</span>
    </SecondaryButton>
  );
};

const CopyPanel: FC<{ post: BlogPost }> = ({ post }) => (
  <div className="flex flex-col gap-[10px]" data-testid="blog-copy">
    <span className="text-[14px] leading-[1.6]">
      Copy it into your website’s blog editor. The title and search description usually have their own boxes there.
    </span>
    <div className="flex flex-wrap gap-[8px]">
      <CopyButton label="Copy title" text={post.title} testId="blog-copy-title" />
      <CopyButton label="Copy search description" text={post.description} testId="blog-copy-description" />
      <CopyButton label="Copy post" html={blogHtml(post.body)} text={blogPlainText(post.body)} testId="blog-copy-post" />
      <CopyButton label="Copy as HTML" text={blogHtml(post.body)} testId="blog-copy-html" />
      <CopyButton label="Copy as plain text" text={blogPlainText(post.body)} testId="blog-copy-text" />
    </div>
  </div>
);

const TitleBlock: FC<{ post: BlogPost }> = ({ post }) => (
  <div className="flex flex-col gap-[6px]">
    <h3 className="text-[19px] font-[600] leading-[1.35]" data-testid="blog-title">
      {post.title}
    </h3>
    <p className="text-[14px] leading-[1.6] text-textItemBlur" data-testid="blog-description">
      <span className="font-[500]">Search description: </span>
      {post.description}
    </p>
  </div>
);

type Mode = 'view' | 'edit' | 'rewrite';

const WaitingPost: FC<{ post: BlogPost; data: Ready; onChanged: () => void }> = ({ post, data, onChanged }) => {
  const fetch = useFetch();
  const [mode, setMode] = useState<Mode>('view');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<null | 'approve' | 'save' | 'rewrite' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState({ title: post.title, description: post.description, body: post.body });
  const [note, setNote] = useState('');

  const act = async (kind: NonNullable<typeof busy>, path: string, init: RequestInit, fallback: string) => {
    setBusy(kind);
    setError(null);
    const res = await fetch(`/ours/blog-posts/${post.id}/${path}`, init);
    setBusy(null);
    if (!res.ok) {
      setError((await readError(res)) || fallback);
      return false;
    }
    onChanged();
    return true;
  };

  const blocks = blogBlocks(post.body).length;

  return (
    <article className="flex flex-col gap-[16px]" data-testid="blog-post" data-status={post.status}>
      <div className="flex items-center justify-between gap-[12px] flex-wrap">
        <span className="text-[13px] text-textItemBlur">
          {post.words.toLocaleString('en-GB')} words
          {post.editedAt ? ' · Edited by you' : ''}
        </span>
        <span className="rounded-full px-[10px] py-[3px] text-[13px] border border-newBorder text-textItemBlur" data-testid="blog-status">
          Waiting for your approval
        </span>
      </div>

      {post.demo && (
        <Notice tone="demo" testId="blog-demo-notice">
          Demo mode: no AI service is connected, so this post was written from simple templates instead of AI. It
          still uses only details from your business profile.
        </Notice>
      )}

      {mode === 'edit' ? (
        <div className="flex flex-col gap-[12px]">
          <label className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-[500]">Title</span>
            <input
              value={words.title}
              onChange={(e) => setWords({ ...words, title: e.target.value })}
              data-testid="blog-edit-title"
              className="h-[40px] rounded-[8px] border border-newBorder bg-newBgColorInner px-[12px] text-[15px] outline-none focus:border-btnPrimary"
            />
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-[500]">Search description</span>
            <textarea
              value={words.description}
              rows={2}
              onChange={(e) => setWords({ ...words, description: e.target.value })}
              data-testid="blog-edit-description"
              className="rounded-[8px] border border-newBorder bg-newBgColorInner p-[12px] text-[15px] leading-[1.6] outline-none focus:border-btnPrimary"
            />
            <span className="text-[12px] text-textItemBlur">
              {words.description.trim().length} characters. Search engines usually show about 155.
            </span>
          </label>
          <label className="flex flex-col gap-[6px]">
            <span className="text-[14px] font-[500]">Post</span>
            <textarea
              value={words.body}
              rows={18}
              onChange={(e) => setWords({ ...words, body: e.target.value })}
              data-testid="blog-edit-body"
              className="rounded-[8px] border border-newBorder bg-newBgColorInner p-[12px] text-[15px] leading-[1.6] outline-none focus:border-btnPrimary"
            />
            <span className="text-[12px] text-textItemBlur">
              Leave a blank line between paragraphs. Start a line with “## ” for a heading, or “- ” for a list item.
            </span>
          </label>
        </div>
      ) : (
        <>
          <TitleBlock post={post} />
          <PostBody body={post.body} limit={expanded ? undefined : PREVIEW_BLOCKS} />
          {blocks > PREVIEW_BLOCKS && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="self-start text-[14px] underline"
              data-testid="blog-expand"
            >
              {expanded ? 'Show less' : 'Read the whole post'}
            </button>
          )}
          {post.facts.length > 0 && (
            <p className="text-[13px] leading-[1.5] text-textItemBlur">
              {post.editedAt ? 'Original post based on: ' : 'Based on: '}
              {post.facts.map((f) => (f.field === 'news' ? `${f.value} (what you told us)` : f.value)).join(' · ')}
            </p>
          )}
          {post.notInProfile.length > 0 && (
            <Notice tone="check" testId="blog-check-note">
              Check before approving: {describeDetails(post.notInProfile)}{' '}
              {post.notInProfile.length === 1 ? 'isn’t' : 'aren’t'} in your business profile. That’s fine if it’s true.
            </Notice>
          )}
        </>
      )}

      {mode === 'rewrite' && (
        <div
          className="flex flex-col gap-[10px] rounded-[10px] border border-newBorder bg-newBgColorInner p-[14px]"
          data-testid="blog-rewrite-panel"
        >
          <label className="flex flex-col gap-[6px]">
            <span className="text-[14px]">What would you like changed? (optional)</span>
            <input
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: shorter, a different topic, more about our team"
              data-testid="blog-rewrite-note"
              disabled={data.demo}
              className="h-[38px] rounded-[8px] border border-newBorder bg-newBgColor px-[10px] text-[14px] outline-none focus:border-btnPrimary"
            />
          </label>
          <p className="text-[13px] leading-[1.5] text-textItemBlur">
            {post.editedAt ? 'The new version replaces the changes you made. ' : ''}
            {data.demo
              ? 'Demo mode: no AI service is connected, so you’ll get the other prepared version of this post, and notes can’t be used.'
              : 'We only use details from your business profile and what you told us. To mention something new, add it to your profile first.'}{' '}
            {post.rewritesLeft === 1 ? '1 new version left for this post.' : `${post.rewritesLeft} new versions left for this post.`}
          </p>
          <div className="flex gap-[10px] flex-wrap">
            <PrimarySmallButton
              testId="blog-rewrite-go"
              disabled={!!busy}
              onClick={async () => {
                if (
                  await act(
                    'rewrite',
                    'rewrite',
                    { method: 'POST', body: JSON.stringify(note.trim() ? { note: note.trim() } : {}) },
                    'We couldn’t write a new version. Please try again.'
                  )
                ) {
                  setMode('view');
                  setNote('');
                }
              }}
            >
              {busy === 'rewrite' ? 'Writing a new version…' : 'Write a new version'}
            </PrimarySmallButton>
            <SecondaryButton onClick={() => setMode('view')} disabled={busy === 'rewrite'}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="text-[14px]" data-testid="blog-error">
          <PlanMessage text={error} />
        </div>
      )}

      {mode === 'edit' ? (
        <div className="flex gap-[10px] flex-wrap">
          <PrimarySmallButton
            testId="blog-edit-save"
            disabled={!!busy}
            onClick={async () => {
              if (
                await act(
                  'save',
                  'words',
                  { method: 'PUT', body: JSON.stringify(words) },
                  'We couldn’t save your changes. Please try again.'
                )
              ) {
                setMode('view');
              }
            }}
          >
            {busy === 'save' ? 'Saving…' : 'Save changes'}
          </PrimarySmallButton>
          <SecondaryButton onClick={() => setMode('view')} disabled={busy === 'save'}>
            Cancel
          </SecondaryButton>
        </div>
      ) : (
        mode === 'view' && (
          <div className="flex gap-[10px] flex-wrap">
            <PrimarySmallButton
              testId="blog-approve"
              disabled={!!busy}
              onClick={() => act('approve', 'approve', { method: 'POST' }, 'We couldn’t approve this post. Please try again.')}
            >
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </PrimarySmallButton>
            <SecondaryButton
              testId="blog-edit"
              disabled={!!busy}
              onClick={() => {
                setWords({ title: post.title, description: post.description, body: post.body });
                setError(null);
                setMode('edit');
              }}
            >
              Edit
            </SecondaryButton>
            <SecondaryButton
              testId="blog-rewrite"
              disabled={!!busy || post.rewritesLeft < 1}
              onClick={() => {
                setError(null);
                setMode('rewrite');
              }}
            >
              {post.rewritesLeft < 1 ? 'No rewrites left' : 'Rewrite'}
            </SecondaryButton>
            <SecondaryButton
              testId="blog-reject"
              disabled={!!busy}
              onClick={() => act('reject', 'reject', { method: 'POST' }, 'We couldn’t reject this post. Please try again.')}
            >
              {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </SecondaryButton>
          </div>
        )
      )}
    </article>
  );
};

const ApprovedPost: FC<{ post: BlogPost }> = ({ post }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="flex flex-col gap-[14px]" data-testid="blog-post" data-status={post.status}>
      <div className="flex items-center justify-between gap-[12px] flex-wrap">
        <span className="text-[13px] text-textItemBlur">
          {post.words.toLocaleString('en-GB')} words{post.approvedAt ? ` · Approved on ${day(post.approvedAt)}` : ''}
        </span>
        <span className="rounded-full px-[10px] py-[3px] text-[13px] border border-btnPrimary text-btnPrimary" data-testid="blog-status">
          Approved
        </span>
      </div>
      <TitleBlock post={post} />
      {expanded && <PostBody body={post.body} />}
      <button type="button" onClick={() => setExpanded(!expanded)} className="self-start text-[14px] underline" data-testid="blog-expand">
        {expanded ? 'Hide the post' : 'Read the post'}
      </button>
      <CopyPanel post={post} />
    </article>
  );
};

const RejectedPost: FC<{ post: BlogPost; onChanged: () => void }> = ({ post, onChanged }) => {
  const fetch = useFetch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (path: string, init: RequestInit, fallback: string) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/ours/blog-posts/${post.id}/${path}`, init);
    setBusy(false);
    if (!res.ok) {
      setError((await readError(res)) || fallback);
      return;
    }
    onChanged();
  };
  return (
    <article
      className="flex flex-col gap-[10px] rounded-[10px] border border-dashed border-newBorder p-[14px]"
      data-testid="blog-post"
      data-status={post.status}
    >
      <div className="flex items-center justify-between gap-[12px] flex-wrap">
        <span className="text-[15px] font-[500] text-textItemBlur line-clamp-1">{post.title}</span>
        <span className="rounded-full px-[10px] py-[3px] text-[13px] border border-newBorder text-textItemBlur" data-testid="blog-status">
          Rejected
        </span>
      </div>
      <div role="group" aria-label="Why didn’t this one work? (optional)" className="flex flex-col gap-[8px]">
        <span className="text-[13px] text-textItemBlur">Why didn’t this one work? (optional)</span>
        <div className="flex flex-wrap gap-[8px]">
          {REJECT_REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={post.rejectReason === r.key}
              data-testid={`blog-reject-reason-${r.key}`}
              disabled={busy}
              onClick={() =>
                act('reject-reason', { method: 'PUT', body: JSON.stringify({ reason: r.key }) }, 'We couldn’t save that. Please try again.')
              }
              className={clsx(
                'h-[32px] px-[12px] rounded-full border text-[13px]',
                post.rejectReason === r.key ? 'border-btnPrimary bg-btnPrimary text-white' : 'border-newBorder hover:bg-newBgColorInner',
                busy && 'opacity-60'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <SecondaryButton
          testId="blog-restore"
          disabled={busy}
          onClick={() => act('restore', { method: 'POST' }, 'We couldn’t bring this post back. Please try again.')}
        >
          Bring back
        </SecondaryButton>
      </div>
      {error && (
        <div role="alert" className="text-[14px]">
          <PlanMessage text={error} />
        </div>
      )}
    </article>
  );
};

// "Anything new to tell customers?" and the button that writes a post.
const WriteForm: FC<{ data: Ready; onChanged: (next: BlogOverview) => void; again: boolean }> = ({ data, onChanged, again }) => {
  const fetch = useFetch();
  const [news, setNews] = useState(data.news || '');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const left = data.allowance.limit - data.allowance.used;

  const write = async () => {
    setStarting(true);
    setError(null);
    const res = await fetch('/ours/blog-posts/write', {
      method: 'POST',
      body: JSON.stringify(news.trim() ? { news: news.trim() } : {}),
    });
    setStarting(false);
    if (!res.ok) {
      setError((await readError(res)) || 'We couldn’t start writing your blog post. Please try again.');
      return;
    }
    onChanged(await res.json());
  };

  if (left <= 0) {
    return (
      <p className="text-[14px] leading-[1.6] text-textItemBlur" data-testid="blog-none-left">
        You’ve written all the blog posts included this{' '}
        {data.allowance.resetsOn ? `month. More from ${day(data.allowance.resetsOn)}.` : 'trial.'} See{' '}
        <Link href="/plan" className="underline">
          Plan and usage
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[12px]" data-testid="blog-write">
      <label className="flex flex-col gap-[6px]">
        <span className="text-[15px] font-[500]">Anything new to tell customers this month? (optional)</span>
        <span className="text-[13px] leading-[1.5] text-textItemBlur">
          A new member of the team, a job you’ve just finished, something new you sell. We’ll build the post around it.
          Otherwise we write from your business profile.
        </span>
        <textarea
          value={news}
          maxLength={data.newsMax}
          rows={3}
          onChange={(e) => setNews(e.target.value)}
          data-testid="blog-news"
          className="rounded-[8px] border border-newBorder bg-newBgColorInner p-[12px] text-[15px] leading-[1.6] outline-none focus:border-btnPrimary"
        />
      </label>
      <div className="flex items-center gap-[12px] flex-wrap">
        <PrimarySmallButton testId="blog-write-go" onClick={write} disabled={starting}>
          {starting ? 'Starting…' : again ? 'Write another blog post' : 'Write a blog post'}
        </PrimarySmallButton>
        <span className="text-[13px] text-textItemBlur">Nothing goes on your website until you approve it and copy it there.</span>
      </div>
      {error && (
        <div role="alert" className="text-[14px]" data-testid="blog-write-error">
          <PlanMessage text={error} />
        </div>
      )}
    </div>
  );
};

export const BlogPostsPanel: FC = () => {
  const { data, mutate } = useBlogPosts();
  if (!data?.on) return null;

  const [latest, ...earlier] = data.posts;
  const open = latest && ['WRITING', 'PENDING_APPROVAL'].includes(latest.status) ? latest : null;
  const { used, limit } = data.allowance;
  // the latest post is shown above whatever its state
  const earlierApproved = earlier.filter((p) => p.status === 'APPROVED');

  return (
    <section
      className="flex flex-col gap-[18px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px]"
      data-testid="blog-panel"
    >
      <div className="flex items-start justify-between gap-[12px] flex-wrap">
        <div className="flex flex-col gap-[4px]">
          <h2 className="text-[18px] font-[600]">Blog post for your website</h2>
          <span className="text-[14px] text-textItemBlur" data-testid="blog-allowance">
            {used} of {limit} written {data.allowance.resetsOn ? 'this month' : 'in your free trial'}
          </span>
        </div>
      </div>

      {open?.status === 'WRITING' ? (
        <div className="flex items-center gap-[14px]" data-testid="blog-writing" aria-live="polite">
          <span className="h-[10px] w-[10px] rounded-full bg-btnPrimary animate-pulse" />
          <div className="flex flex-col gap-[4px]">
            <span className="text-[15px]">Writing your blog post</span>
            <span className="text-[13px] text-textItemBlur">
              This usually takes a minute or two. You can leave this page; we’ll keep going.
            </span>
          </div>
        </div>
      ) : open ? (
        <WaitingPost key={open.id} post={open} data={data} onChanged={() => mutate()} />
      ) : (
        <>
          {latest?.status === 'FAILED' && (
            <div role="alert" data-testid="blog-failed">
              <Notice>{latest.errorMessage || 'Something went wrong while writing your blog post.'}</Notice>
            </div>
          )}
          {latest?.status === 'APPROVED' && <ApprovedPost post={latest} />}
          {latest?.status === 'REJECTED' && <RejectedPost post={latest} onChanged={() => mutate()} />}
          <WriteForm data={data} again={!!latest} onChanged={(next) => mutate(next, { revalidate: false })} />
        </>
      )}

      {earlierApproved.length > 0 && (
        <details className="flex flex-col gap-[10px]" data-testid="blog-earlier">
          <summary className="cursor-pointer text-[14px] text-textItemBlur">Earlier approved posts ({earlierApproved.length})</summary>
          <div className="flex flex-col gap-[18px] pt-[12px]">
            {earlierApproved.map((p) => (
              <ApprovedPost key={p.id} post={p} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
};
