'use client';
// OURS: data for the blog post card on the review screen (blog posts B1).
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type BlogPostStatus = 'WRITING' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'FAILED';

export interface BlogPost {
  id: string;
  status: BlogPostStatus;
  // the owner's answer to "Anything new to tell customers?"
  news: string | null;
  title: string;
  // the summary search engines show under the title
  description: string;
  // "## " headings, "- " list items, blank lines between paragraphs
  body: string;
  words: number;
  facts: { field: string; value: string }[];
  // written from templates because no AI service is connected
  demo: boolean;
  errorMessage: string | null;
  startedAt: string;
  editedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  rewritesLeft: number;
  // details in the owner's own words that the profile doesn't have
  notInProfile: string[];
}

export type BlogOverview =
  | { on: false }
  | {
      on: true;
      demo: boolean;
      allowance: { used: number; limit: number; resetsOn: string | null };
      maxRewrites: number;
      newsMax: number;
      // this month's answer, offered again for the next post
      news: string | null;
      // newest first
      posts: BlogPost[];
    };

export const useBlogPosts = () => {
  const fetch = useFetch();
  return useSWR<BlogOverview>(
    'ours-blog-posts',
    async () => {
      const res = await fetch('/ours/blog-posts');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    {
      refreshInterval: (data) =>
        data?.on && data.posts.some((p) => p.status === 'WRITING') ? 1500 : 0,
      revalidateOnFocus: false,
    }
  );
};
