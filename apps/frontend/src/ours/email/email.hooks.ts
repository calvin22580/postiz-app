'use client';
// OURS: data for the email list screen (email campaigns EM1, EM2).
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
