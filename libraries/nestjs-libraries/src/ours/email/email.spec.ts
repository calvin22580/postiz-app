// OURS: tests for the email list (email campaigns EM1): reading uploaded and
// pasted lists, the unsubscribe token, and the import rules (refused basis,
// blocked addresses, the plan's contact limit).
import { describe, expect, it, vi } from 'vitest';
import {
  emailHash,
  MAX_UPLOAD_ROWS,
  parseContactsCsv,
  parsePastedContacts,
  readUnsubscribeToken,
  REFUSED_BASIS_MESSAGE,
  unsubscribeToken,
} from '@gitroom/nestjs-libraries/ours/email/email.contacts';
import { EmailService } from '@gitroom/nestjs-libraries/ours/email/email.service';
import { contactLimitMessage } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { findPlan, TRIAL_PLAN } from '@gitroom/nestjs-libraries/ours/plans/plans.config';

describe('parseContactsCsv', () => {
  it('reads a spreadsheet with a BOM, semicolons and first/last name columns', () => {
    const csv = '﻿First name;Surname;E-mail\nAnn;Smith; Ann@Example.com \nBob;Jones;bob@example.com\n';
    expect(parseContactsCsv(csv)).toEqual({
      contacts: [
        { email: 'ann@example.com', name: 'Ann Smith' },
        { email: 'bob@example.com', name: 'Bob Jones' },
      ],
      invalid: 0,
      duplicates: 0,
      tooMany: 0,
    });
  });

  it('keeps quoted commas inside a name, and counts bad and repeated rows', () => {
    const csv = 'Name,Email Address\n"Jones, Bob",bob@example.com\nNo address,\nTypo,ann@example\nBob again,BOB@example.com\n';
    const parsed = parseContactsCsv(csv);
    expect(parsed.contacts).toEqual([{ email: 'bob@example.com', name: 'Jones, Bob' }]);
    expect(parsed.invalid).toBe(2);
    expect(parsed.duplicates).toBe(1);
  });

  it('finds the address column when there is no header row', () => {
    const parsed = parseContactsCsv('Ann,ann@example.com,07700900000\nBob,bob@example.co.uk,\n');
    expect(parsed.contacts.map((c) => c.email)).toEqual(['ann@example.com', 'bob@example.co.uk']);
    expect(parsed.contacts[0].name).toBeNull();
  });

  it('finds nothing in a file with no addresses', () => {
    expect(parseContactsCsv('Name,Phone\nAnn,07700900000\n').contacts).toEqual([]);
    expect(parseContactsCsv('').contacts).toEqual([]);
  });

  it('reads at most the row limit and counts the rest', () => {
    const rows = Array.from({ length: MAX_UPLOAD_ROWS + 3 }, (_, i) => `p${i}@example.com`);
    const parsed = parseContactsCsv(`Email\n${rows.join('\n')}\n`);
    expect(parsed.contacts).toHaveLength(MAX_UPLOAD_ROWS);
    expect(parsed.tooMany).toBeGreaterThan(0);
  });
});

describe('parsePastedContacts', () => {
  it('takes addresses on lines, with commas or as "Name <address>", and skips the names', () => {
    const parsed = parsePastedContacts('Cara <cara@example.com>, bob@example.com;\ndan@example.co.uk bob@example.com not@valid');
    expect(parsed.contacts.map((c) => c.email)).toEqual(['cara@example.com', 'bob@example.com', 'dan@example.co.uk']);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.invalid).toBe(1);
  });
});

describe('unsubscribe token', () => {
  const env = { OURS_EMAIL_TOKEN_SECRET: 'test-secret' } as NodeJS.ProcessEnv;

  it('gives back the contact it was made for', () => {
    expect(readUnsubscribeToken(unsubscribeToken('contact-1', env), env)).toBe('contact-1');
  });

  it('refuses a changed, made-up or differently signed token', () => {
    const token = unsubscribeToken('contact-1', env);
    const otherId = `${Buffer.from('contact-2').toString('base64url')}.${token.split('.')[1]}`;
    expect(readUnsubscribeToken(otherId, env)).toBeNull();
    expect(readUnsubscribeToken(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`, env)).toBeNull();
    expect(readUnsubscribeToken('nonsense', env)).toBeNull();
    expect(readUnsubscribeToken(undefined, env)).toBeNull();
    expect(readUnsubscribeToken(token, { OURS_EMAIL_TOKEN_SECRET: 'other' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('falls back to JWT_SECRET, and refuses to make or read one with no secret', () => {
    const jwtOnly = { JWT_SECRET: 'jwt' } as NodeJS.ProcessEnv;
    expect(readUnsubscribeToken(unsubscribeToken('c', jwtOnly), jwtOnly)).toBe('c');
    expect(() => unsubscribeToken('c', {} as NodeJS.ProcessEnv)).toThrow();
    expect(readUnsubscribeToken(unsubscribeToken('c', env), {} as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe('contact limit message', () => {
  it('says how many are included and which plan has more', () => {
    expect(contactLimitMessage(findPlan('starter')!, 500)).toBe(
      'Your Starter plan includes 500 people on your email list, and you have 500. Growth includes 2000: see Plan and usage.'
    );
    expect(contactLimitMessage(findPlan('pro')!, 5000)).toMatch(/Remove someone to add another\.$/);
    expect(contactLimitMessage(TRIAL_PLAN, 100)).toContain('100 people');
  });
});

// An in-memory EmailRepository with the same skip-duplicates behaviour.
const makeService = (opts: { room?: number; existing?: string[]; blocked?: string[] } = {}) => {
  const contacts = new Map<string, { email: string; status: string; organizationId: string; id: string }>();
  for (const email of opts.existing || []) {
    contacts.set(email, { email, status: 'SUBSCRIBED', organizationId: 'org-1', id: `id-${email}` });
  }
  const suppressed = new Set((opts.blocked || []).map(emailHash));
  const repo = {
    countsByStatus: vi.fn(async () => ({ SUBSCRIBED: contacts.size })),
    getForm: vi.fn(async () => null),
    organisationName: vi.fn(async () => 'Test Cafe'),
    suppressedHashes: vi.fn(async (_o: string, hashes: string[]) => new Set(hashes.filter((h) => suppressed.has(h)))),
    existingEmails: vi.fn(async (_o: string, emails: string[]) => new Set(emails.filter((e) => contacts.has(e)))),
    isSuppressed: vi.fn(async (_o: string, hash: string) => suppressed.has(hash)),
    getContactByEmail: vi.fn(async (_o: string, email: string) => contacts.get(email) || null),
    createImport: vi.fn(async () => ({ id: 'import-1' })),
    finishImport: vi.fn(async () => ({ count: 1 })),
    createContacts: vi.fn(async (_o: string, list: { email: string; status?: string }[]) => {
      let added = 0;
      for (const c of list) {
        if (!contacts.has(c.email)) {
          contacts.set(c.email, { email: c.email, status: c.status || 'SUBSCRIBED', organizationId: 'org-1', id: `id-${c.email}` });
          added++;
        }
      }
      return added;
    }),
    contactForToken: vi.fn(async (id: string) => [...contacts.values()].find((c) => c.id === id) || null),
    suppress: vi.fn(async (_o: string, email: string, hash: string) => {
      suppressed.add(hash);
      contacts.get(email)!.status = 'UNSUBSCRIBED';
    }),
  };
  const plans = {
    current: vi.fn(async () => ({ plan: findPlan('starter')! })),
    contactRoom: vi.fn(async () => ({ room: opts.room ?? 500, limit: 500, message: 'Your Starter plan includes 500 people.' })),
  };
  const profiles = { getProfile: vi.fn(async () => ({ profile: null })) };
  const service = new EmailService(repo as never, plans as never, profiles as never);
  return { service, repo, contacts };
};

describe('EmailService.importContacts', () => {
  it('refuses a bought or "other" list, and an unticked statement', async () => {
    const { service, repo } = makeService();
    const refused = await service.importContacts('org-1', 'u1', { basis: 'OTHER', confirmed: true, text: 'a@example.com' }).catch((e) => e);
    expect(refused.message).toBe(REFUSED_BASIS_MESSAGE);
    const unticked = await service.importContacts('org-1', 'u1', { basis: 'CONSENT', confirmed: false, text: 'a@example.com' }).catch((e) => e);
    expect(unticked.getStatus()).toBe(400);
    expect(repo.createContacts).not.toHaveBeenCalled();
  });

  it('keeps the statement the owner confirmed with the upload', async () => {
    const { service, repo } = makeService();
    await service.importContacts('org-1', 'u1', { basis: 'SOFT_OPT_IN', confirmed: true, csv: 'Email\na@example.com\n', fileName: 'list.csv' });
    expect(repo.createImport).toHaveBeenCalledWith('org-1', expect.objectContaining({
      userId: 'u1',
      fileName: 'list.csv',
      basis: 'SOFT_OPT_IN',
      statement: expect.stringContaining('I confirm Test Cafe collected these addresses itself'),
    }));
  });

  it('never re-adds someone who unsubscribed, and skips people already on the list', async () => {
    const { service } = makeService({ existing: ['ann@example.com'], blocked: ['bob@example.com'] });
    const { result } = await service.importContacts('org-1', 'u1', {
      basis: 'CONSENT',
      confirmed: true,
      text: 'ann@example.com bob@example.com cara@example.com',
    });
    expect(result).toMatchObject({ added: 1, alreadyOnList: 1, blocked: 1, overLimit: 0, limitMessage: null });
  });

  it('adds only as many as the plan has room for, and says why', async () => {
    const { service } = makeService({ room: 2 });
    const { result } = await service.importContacts('org-1', 'u1', {
      basis: 'CONSENT',
      confirmed: true,
      text: 'a@example.com b@example.com c@example.com d@example.com',
    });
    expect(result).toMatchObject({ added: 2, overLimit: 2 });
    expect(result.limitMessage).toContain('500 people');
  });
});

describe('EmailService unsubscribe', () => {
  it('unsubscribes for good from a real token, and ignores a bad one without throwing', async () => {
    process.env.OURS_EMAIL_TOKEN_SECRET = 'spec-secret';
    try {
      const { service, contacts } = makeService({ existing: ['ann@example.com'] });
      await expect(service.unsubscribe('not-a-token')).resolves.toBe(false);
      const token = unsubscribeToken('id-ann@example.com');
      await expect(service.unsubscribe(token)).resolves.toBe(true);
      expect(contacts.get('ann@example.com')!.status).toBe('UNSUBSCRIBED');
      const again = await service.addContact('org-1', { email: 'ann@example.com', basis: 'CONSENT' }).catch((e) => e);
      expect(again.message).toContain('unsubscribed');
    } finally {
      delete process.env.OURS_EMAIL_TOKEN_SECRET;
    }
  });
});

describe('EmailService sign-up form', () => {
  it('ignores bots that fill the hidden field, and adds a real sign-up as waiting', async () => {
    const { service, repo, contacts } = makeService();
    repo['formByPublicId' as never] = vi.fn(async () => ({ organizationId: 'org-1', enabled: true })) as never;
    await expect(service.signUp('f1', { email: 'bot@example.com', consent: true, website: 'spam' })).resolves.toEqual({ ok: true });
    expect(contacts.has('bot@example.com')).toBe(false);
    await service.signUp('f1', { email: 'Fay@Example.com', consent: true });
    expect(contacts.get('fay@example.com')!.status).toBe('PENDING_CONFIRMATION');
  });
});
