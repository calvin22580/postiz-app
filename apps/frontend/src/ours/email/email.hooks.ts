'use client';
// OURS: data for the email list screen (email campaigns EM1 to EM3).
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface EmailBasis {
  key: 'CONSENT' | 'SOFT_OPT_IN';
  label: string;
  // what the owner confirms, naming their business
  statement: string;
}

export interface EmailOverview {
  businessName: string;
  counts: { subscribed: number; waiting: number; unsubscribed: number; blocked: number };
  limit: { used: number; limit: number };
  bases: EmailBasis[];
  form: { enabled: boolean; url: string | null; consent: string };
}

export type ContactStatus = 'SUBSCRIBED' | 'PENDING_CONFIRMATION' | 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED';
export type ContactFilter = '' | 'subscribed' | 'waiting' | 'unsubscribed' | 'blocked';

export interface EmailContact {
  id: string;
  email: string;
  name: string | null;
  status: ContactStatus;
  basis: 'CONSENT' | 'SOFT_OPT_IN';
  source: 'IMPORT' | 'FORM' | 'MANUAL';
  consentAt: string;
  statusChangedAt: string;
  createdAt: string;
}

export interface ContactPage {
  contacts: EmailContact[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportResult {
  added: number;
  alreadyOnList: number;
  invalid: number;
  blocked: number;
  overLimit: number;
  duplicatesInFile: number;
  tooManyRows: number;
  limitMessage: string | null;
}

export const useEmailOverview = () => {
  const fetch = useFetch();
  return useSWR<EmailOverview>(
    'ours-email',
    async () => {
      const res = await fetch('/ours/email');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};

export const useEmailContacts = (search: string, status: ContactFilter, page: number) => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    page: String(page),
  }).toString();
  return useSWR<ContactPage>(
    `ours-email-contacts?${query}`,
    async () => {
      const res = await fetch(`/ours/email/contacts?${query}`);
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    { revalidateOnFocus: false, keepPreviousData: true }
  );
};

export interface EmailSending {
  // off: nothing can be sent; simulated: recorded, never sent; ses: real email
  sender: 'off' | 'simulated' | 'ses';
  latestTest: {
    to: string;
    status: 'WAITING' | 'APPROVED' | 'SENDING' | 'SENT' | 'REJECTED' | 'CANCELLED' | 'FAILED';
    sentWith: 'simulated' | 'ses' | null;
    createdAt: string;
    finishedAt: string | null;
  } | null;
}

export const useEmailSending = () => {
  const fetch = useFetch();
  return useSWR<EmailSending>(
    'ours-email-sending',
    async () => {
      const res = await fetch('/ours/email/sending');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    {
      revalidateOnFocus: false,
      // while a test is on its way, check again every few seconds
      refreshInterval: (data) =>
        data?.latestTest && ['APPROVED', 'SENDING'].includes(data.latestTest.status) ? 3000 : 0,
    }
  );
};

// Email campaigns EM3: list emails written for the owner to approve.
export type CampaignStatus = 'WAITING' | 'APPROVED' | 'SENDING' | 'SENT' | 'REJECTED' | 'CANCELLED' | 'FAILED';

export interface EmailCampaign {
  id: string;
  status: CampaignStatus;
  subject: string;
  previewText: string;
  body: string;
  // demo: written without the AI service, labelled on screen
  writer: 'anthropic' | 'demo' | null;
  facts: { id: string; field: string; value: string; label?: string }[];
  edited: boolean;
  rewritesLeft: number;
  // the owner's own words the profile doesn't back up
  unsupported: string[];
  scheduledAt: string | null;
  approvedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  sentWith: 'simulated' | 'ses' | null;
  recipients: number;
  sent: number;
  failed: number;
  createdAt: string;
}

export interface EmailCampaigns {
  sender: 'off' | 'simulated' | 'ses';
  writer: 'anthropic' | 'demo';
  // people subscribed now, who an email would go to
  recipients: number;
  allowance: { used: number; limit: number; resetsOn: string | null };
  suggestedSendAt: string;
  timezone: string;
  campaigns: EmailCampaign[];
}

export const useEmailCampaigns = () => {
  const fetch = useFetch();
  return useSWR<EmailCampaigns>(
    'ours-email-campaigns',
    async () => {
      const res = await fetch('/ours/email/campaigns');
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    {
      revalidateOnFocus: false,
      // while an email is going out, or due within a few minutes, check again
      refreshInterval: (data) =>
        data?.campaigns.some(
          (c) =>
            c.status === 'SENDING' ||
            (c.status === 'APPROVED' && !!c.scheduledAt && new Date(c.scheduledAt).getTime() - Date.now() < 5 * 60 * 1000)
        )
          ? 5000
          : 0,
    }
  );
};
