// OURS: tests for sending list emails (email campaigns EM2): what every email
// carries, the send loop's rules (skip anyone no longer subscribed, never send
// twice, stop when the sender pauses us), the SES error mapping, and Amazon's
// bounce and complaint events.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createSign, generateKeyPairSync } from 'node:crypto';
import {
  composeEmail,
  EmailCampaignService,
  fromLocalPart,
  reasonFor,
  sendingAddress,
  unsubscribeHeaders,
} from '@gitroom/nestjs-libraries/ours/email/email.campaign.service';
import {
  confirmToken,
  readConfirmToken,
  readUnsubscribeToken,
  unsubscribeToken,
} from '@gitroom/nestjs-libraries/ours/email/email.contacts';
import {
  EmailCampaignSender,
  EmailSenderError,
  OutgoingEmail,
} from '@gitroom/nestjs-libraries/ours/email/senders/email.sender';
import { fromHeader, SesEmailSender } from '@gitroom/nestjs-libraries/ours/email/senders/ses.email.sender';
import {
  EmailEventsService,
  isSnsUrl,
  snsStringToSign,
  SnsMessage,
} from '@gitroom/nestjs-libraries/ours/email/email.events.service';

describe('composeEmail', () => {
  const email = composeEmail({
    business: 'Ann’s <Cafe>',
    address: '1 High Street, Leeds',
    subject: 'Winter menu',
    previewText: 'Soup is back',
    body: 'Hello all,\n\nSoup & bread is back.\nFrom Monday.',
    reason: reasonFor('Ann’s <Cafe>', 'CONSENT'),
    unsubscribeUrl: 'https://app.example/unsubscribe.html?t=abc',
  });

  it('carries the footer: why they get it, the business and its address, and an unsubscribe link', () => {
    expect(email.text).toContain('You’re getting this because you asked to hear from Ann’s <Cafe>.');
    expect(email.text).toContain('Ann’s <Cafe>, 1 High Street, Leeds');
    expect(email.text).toContain('Unsubscribe: https://app.example/unsubscribe.html?t=abc');
    expect(email.html).toContain('href="https://app.example/unsubscribe.html?t=abc"');
    expect(email.html).toContain('Soup is back');
  });

  it('escapes the business’s own text in the HTML', () => {
    expect(email.html).toContain('Ann’s &lt;Cafe&gt;');
    expect(email.html).toContain('Soup &amp; bread is back.<br>From Monday.');
    expect(email.html).not.toContain('<Cafe>');
  });

  it('adds a button when asked, and no unsubscribe link without one', () => {
    const confirm = composeEmail({
      business: 'Cafe',
      address: null,
      subject: 'Please confirm',
      body: 'Thanks.',
      reason: 'You signed up.',
      button: { label: 'Confirm my sign-up', url: 'https://app.example/confirm-email.html?t=x' },
    });
    expect(confirm.text).toContain('Confirm my sign-up: https://app.example/confirm-email.html?t=x');
    expect(confirm.html).toContain('href="https://app.example/confirm-email.html?t=x"');
    expect(confirm.text).not.toContain('Unsubscribe');
  });

  it('says why for each basis', () => {
    expect(reasonFor('Cafe', 'SOFT_OPT_IN')).toContain('you bought from Cafe');
    expect(reasonFor('Cafe', null)).toContain('test email');
  });
});

describe('sending address and headers', () => {
  it('makes a plain address from the business name', () => {
    expect(fromLocalPart('Café & Co.')).toBe('cafe-co');
    expect(fromLocalPart('★★★')).toBe('news');
    expect(sendingAddress('The Old Mill', {} as NodeJS.ProcessEnv)).toBe('the-old-mill@news.kanosena.com');
    expect(sendingAddress('Mill', { OURS_EMAIL_FROM_DOMAIN: 'mail.example.com' } as NodeJS.ProcessEnv)).toBe(
      'mill@mail.example.com'
    );
  });

  it('gives mail apps a one-click unsubscribe', () => {
    expect(unsubscribeHeaders('https://api.example/u?t=1')).toEqual({
      'List-Unsubscribe': '<https://api.example/u?t=1>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('encodes a non-ASCII sender name', () => {
    expect(fromHeader('Cafe "One"', 'a@b.com')).toBe('"Cafe \\"One\\"" <a@b.com>');
    expect(fromHeader('Café', 'a@b.com')).toBe(`=?UTF-8?B?${Buffer.from('Café').toString('base64')}?= <a@b.com>`);
  });
});

describe('confirm token', () => {
  const env = { OURS_EMAIL_TOKEN_SECRET: 'secret' } as NodeJS.ProcessEnv;
  it('reads back, and is not an unsubscribe token (or the other way round)', () => {
    expect(readConfirmToken(confirmToken('c-1', env), env)).toBe('c-1');
    expect(readUnsubscribeToken(confirmToken('c-1', env), env)).toBeNull();
    expect(readConfirmToken(unsubscribeToken('c-1', env), env)).toBeNull();
  });
});

// An in-memory campaign repository for the send loop.
type Delivery = { id: string; email: string; contactId: string | null; status: string; messageId?: string; error?: string };
const makeLoop = (contacts: { id: string; email: string; status: string }[], send: (e: OutgoingEmail) => Promise<{ messageId: string }>) => {
  const campaign = { id: 'camp-1', organizationId: 'org-1', status: 'APPROVED', test: false, testTo: null, subject: 'Hi', previewText: null, body: 'Hello.', startedAt: null as Date | null };
  const deliveries: Delivery[] = [];
  let due = true;
  const repo = {
    pendingConfirmations: vi.fn(async () => []),
    dueCampaignIds: vi.fn(async () => (due ? [{ id: 'camp-1', organizationId: 'org-1' }] : [])),
    lease: vi.fn(async () => true),
    renewLease: vi.fn(async () => true),
    getCampaign: vi.fn(async () => ({ ...campaign })),
    getSenderSetup: vi.fn(async () => null),
    subscribedRecipients: vi.fn(async () => contacts.filter((c) => c.status === 'SUBSCRIBED').map((c) => ({ ...c, basis: 'CONSENT' }))),
    startSending: vi.fn(async (_o: string, _id: string, _s: string, list: { email: string; contactId: string | null }[]) => {
      list.forEach((r, i) => deliveries.push({ id: `d-${i}`, status: 'QUEUED', ...r }));
      campaign.status = 'SENDING';
      campaign.startedAt = new Date();
    }),
    queuedDeliveries: vi.fn(async () => deliveries.filter((d) => d.status === 'QUEUED')),
    contactsForDelivery: vi.fn(async (_o: string, ids: string[]) =>
      contacts.filter((c) => ids.includes(c.id)).map((c) => ({ ...c, basis: 'CONSENT' }))
    ),
    moveDelivery: vi.fn(async (_o: string, id: string, from: string, data: Partial<Delivery>) => {
      const d = deliveries.find((x) => x.id === id && x.status === from);
      if (!d) return false;
      Object.assign(d, data);
      return true;
    }),
    finishCampaign: vi.fn(async (_o: string, _id: string, _owner: string, paused = false) => {
      campaign.status = paused ? 'FAILED' : 'SENT';
      due = false;
    }),
  };
  const emailService = {
    businessDetails: vi.fn(async () => ({ name: 'Test Cafe', address: '1 High St', email: 'owner@cafe.example' })),
  };
  // the writing side (EM3) isn't used by the send loop
  const unused = {} as never;
  const service = new EmailCampaignService(repo as never, emailService as never, unused, unused, unused, unused, unused);
  const sender: EmailCampaignSender = { name: 'simulated', prepare: vi.fn(async () => null), send: vi.fn(send) };
  service._sender = sender;
  return { service, repo, deliveries, campaign, sender };
};

describe('EmailCampaignService send loop', () => {
  beforeEach(() => {
    process.env.OURS_EMAIL_SEND_PER_SECOND = '1000';
    process.env.OURS_EMAIL_TOKEN_SECRET = 'secret';
    process.env.FRONTEND_URL = 'https://app.example';
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example';
  });

  it('sends to everyone subscribed, skips anyone who unsubscribed since, and finishes', async () => {
    const contacts = [
      { id: 'c-1', email: 'ann@example.com', status: 'SUBSCRIBED' },
      { id: 'c-2', email: 'bob@example.com', status: 'SUBSCRIBED' },
    ];
    let n = 0;
    const loop = makeLoop(contacts, async (e) => {
      // Bob unsubscribes while Ann's email is going
      contacts[1].status = 'UNSUBSCRIBED';
      return { messageId: `m-${++n}-${e.to}` };
    });
    // Bob unsubscribes after the list was taken but before his turn
    loop.repo.contactsForDelivery.mockImplementationOnce(async () => [
      { ...contacts[0], basis: 'CONSENT' },
      { ...contacts[1], status: 'UNSUBSCRIBED', basis: 'CONSENT' },
    ]);
    await loop.service.tick();
    expect(loop.deliveries.map((d) => [d.email, d.status])).toEqual([
      ['ann@example.com', 'SIMULATED'],
      ['bob@example.com', 'SKIPPED'],
    ]);
    expect(loop.sender.send).toHaveBeenCalledTimes(1);
    const sent = (loop.sender.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as OutgoingEmail;
    expect(sent.fromAddress).toBe('test-cafe@news.kanosena.com');
    expect(sent.replyTo).toBe('owner@cafe.example');
    expect(sent.headers['List-Unsubscribe']).toMatch(/^<https:\/\/api\.example\/ours\/email\/public\/unsubscribe\?t=/);
    expect(sent.text).toContain('https://app.example/unsubscribe.html?t=');
    expect(sent.tags).toEqual({ organization: 'org-1', delivery: 'd-0' });
    expect(loop.repo.finishCampaign).toHaveBeenCalled();
  });

  it('marks a refused address as failed and carries on', async () => {
    const contacts = [
      { id: 'c-1', email: 'bad@example.com', status: 'SUBSCRIBED' },
      { id: 'c-2', email: 'ok@example.com', status: 'SUBSCRIBED' },
    ];
    const loop = makeLoop(contacts, async (e) => {
      if (e.to === 'bad@example.com') throw new EmailSenderError('MessageRejected: no', 'reject');
      return { messageId: 'm-1' };
    });
    await loop.service.tick();
    expect(loop.deliveries.map((d) => d.status)).toEqual(['FAILED', 'SIMULATED']);
    expect(loop.repo.finishCampaign).toHaveBeenCalled();
  });

  it('puts the email back and stops for now when the sender is busy, without sending anything twice', async () => {
    const contacts = [{ id: 'c-1', email: 'ann@example.com', status: 'SUBSCRIBED' }];
    let calls = 0;
    const loop = makeLoop(contacts, async () => {
      if (++calls === 1) throw new EmailSenderError('TooManyRequestsException: slow down', 'retry');
      return { messageId: 'm-1' };
    });
    await loop.service.tick();
    expect(loop.deliveries[0].status).toBe('QUEUED');
    expect(loop.repo.finishCampaign).not.toHaveBeenCalled();
    // next run picks it up again
    await loop.service.tick();
    expect(loop.deliveries[0].status).toBe('SIMULATED');
    expect(calls).toBe(2);
  });

  it('never sends again an email that may have gone (a timeout or dropped connection)', async () => {
    const contacts = [
      { id: 'c-1', email: 'ann@example.com', status: 'SUBSCRIBED' },
      { id: 'c-2', email: 'bob@example.com', status: 'SUBSCRIBED' },
    ];
    let calls = 0;
    const loop = makeLoop(contacts, async () => {
      if (++calls === 1) throw new Error('socket hang up');
      return { messageId: 'm-2' };
    });
    await loop.service.tick();
    await loop.service.tick();
    expect(loop.deliveries.map((d) => d.status)).toEqual(['FAILED', 'SIMULATED']);
    expect(loop.deliveries[0].error).toContain('not sent again');
    expect(calls).toBe(2);
  });

  it('stops when another backend has taken the campaign over', async () => {
    const loop = makeLoop([{ id: 'c-1', email: 'ann@example.com', status: 'SUBSCRIBED' }], async () => ({ messageId: 'm' }));
    loop.repo.renewLease.mockImplementation(async () => false);
    await loop.service.tick();
    expect(loop.sender.send).not.toHaveBeenCalled();
    expect(loop.repo.finishCampaign).not.toHaveBeenCalled();
    expect(loop.deliveries[0].status).toBe('QUEUED');
  });

  it('stops the campaign when the sender pauses the business', async () => {
    const contacts = [
      { id: 'c-1', email: 'ann@example.com', status: 'SUBSCRIBED' },
      { id: 'c-2', email: 'bob@example.com', status: 'SUBSCRIBED' },
    ];
    const loop = makeLoop(contacts, async () => {
      throw new EmailSenderError('SendingPausedException: paused', 'paused');
    });
    await loop.service.tick();
    expect(loop.sender.send).toHaveBeenCalledTimes(1);
    expect(loop.repo.finishCampaign).toHaveBeenCalledWith('org-1', 'camp-1', expect.any(String), true);
    expect(loop.deliveries.map((d) => d.status)).toEqual(['QUEUED', 'QUEUED']);
  });

  it('refuses a test email while sending is off', async () => {
    const loop = makeLoop([], async () => ({ messageId: 'x' }));
    loop.service._sender = null;
    await expect(loop.service.sendTest('org-1', { id: 'u-1', email: 'owner@cafe.example' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('SesEmailSender', () => {
  const failing = (name: string) => {
    const client = { send: vi.fn(async () => Promise.reject(Object.assign(new Error('nope'), { name }))) };
    return new SesEmailSender(client as never, {} as NodeJS.ProcessEnv);
  };
  const email: OutgoingEmail = {
    organizationId: 'org-1',
    to: 'a@example.com',
    fromName: 'Cafe',
    fromAddress: 'cafe@news.example',
    subject: 'Hi',
    html: '<p>Hi</p>',
    text: 'Hi',
    headers: {},
    tags: {},
  };

  it.each([
    ['MessageRejected', 'reject'],
    ['SendingPausedException', 'paused'],
    ['AccountSuspendedException', 'paused'],
    ['TooManyRequestsException', 'retry'],
    ['TimeoutError', 'unknown'],
    ['InternalFailure', 'unknown'],
  ])('treats %s as %s', async (name, kind) => {
    await expect(failing(name).send(email)).rejects.toMatchObject({ kind });
  });

  it('sends through the business’s tenant and configuration set, with headers and tags', async () => {
    const client = { send: vi.fn(async () => ({ MessageId: 'ses-1' })) };
    const sender = new SesEmailSender(client as never, {} as NodeJS.ProcessEnv);
    const result = await sender.send({
      ...email,
      headers: { 'List-Unsubscribe': '<https://x>' },
      tags: { organization: 'org-1' },
      setup: { tenantName: 'kanosena-org-1', configurationSet: 'kanosena-org-1' },
    });
    expect(result).toEqual({ messageId: 'ses-1' });
    const input = (client.send.mock.calls[0] as unknown[])[0] as { input: Record<string, unknown> };
    expect(input.input).toMatchObject({
      TenantName: 'kanosena-org-1',
      ConfigurationSetName: 'kanosena-org-1',
      EmailTags: [{ Name: 'organization', Value: 'org-1' }],
      Content: { Simple: { Headers: [{ Name: 'List-Unsubscribe', Value: '<https://x>' }] } },
    });
  });
});

describe('Amazon SNS events', () => {
  const topic = 'arn:aws:sns:eu-west-2:123456789012:kanosena-email-events';
  const certUrl = 'https://sns.eu-west-2.amazonaws.com/SimpleNotificationService-abc.pem';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const signed = (fields: Partial<SnsMessage>): SnsMessage => {
    const message = {
      Type: 'Notification',
      MessageId: 'sns-1',
      TopicArn: topic,
      Message: '{}',
      Timestamp: '2026-11-25T12:00:00.000Z',
      SignatureVersion: '2',
      SigningCertURL: certUrl,
      Signature: '',
      ...fields,
    } as SnsMessage;
    message.Signature = createSign('RSA-SHA256').update(snsStringToSign(message), 'utf8').sign(privateKey, 'base64');
    return message;
  };

  const makeEvents = (delivery: { id: string; organizationId: string } | null = { id: 'd-1', organizationId: 'org-1' }) => {
    const emailRepository = { suppress: vi.fn(async () => undefined) };
    const campaignRepository = {
      deliveryForMessage: vi.fn(async () => delivery),
      markDeliveryEvent: vi.fn(async () => ({ count: 1 })),
    };
    const service = new EmailEventsService(emailRepository as never, campaignRepository as never);
    const fetches: string[] = [];
    service._fetch = vi.fn(async (url: string) => {
      fetches.push(url);
      return new Response(url === certUrl ? publicPem : 'ok');
    });
    return { service, emailRepository, campaignRepository, fetches };
  };

  beforeEach(() => {
    process.env.OURS_EMAIL_SNS_TOPIC_ARN = topic;
  });

  it('only trusts Amazon’s own SNS hosts', () => {
    expect(isSnsUrl(certUrl, '.pem')).toBe(true);
    expect(isSnsUrl('http://sns.eu-west-2.amazonaws.com/x.pem', '.pem')).toBe(false);
    expect(isSnsUrl('https://sns.eu-west-2.amazonaws.com.evil.example/x.pem', '.pem')).toBe(false);
    expect(isSnsUrl('https://evil.example/x.pem', '.pem')).toBe(false);
  });

  it('blocks the address for good on a permanent bounce, and marks the delivery', async () => {
    const events = makeEvents();
    const bounce = {
      eventType: 'Bounce',
      mail: { messageId: 'ses-1' },
      bounce: { bounceType: 'Permanent', bouncedRecipients: [{ emailAddress: 'Ann@Example.com' }] },
    };
    expect(await events.service.receive(JSON.stringify(signed({ Message: JSON.stringify(bounce) })))).toBe('ok');
    expect(events.emailRepository.suppress).toHaveBeenCalledWith('org-1', 'ann@example.com', expect.any(String), 'BOUNCED');
    expect(events.campaignRepository.markDeliveryEvent).toHaveBeenCalledWith('org-1', 'd-1', 'BOUNCED');
  });

  it('blocks on a complaint, using the organisation tag when there is no delivery (a confirmation email)', async () => {
    const events = makeEvents(null);
    const complaint = {
      eventType: 'Complaint',
      mail: { messageId: 'ses-2', tags: { organization: ['org-2'] } },
      complaint: { complainedRecipients: [{ emailAddress: 'bob@example.com' }] },
    };
    await events.service.receive(JSON.stringify(signed({ Message: JSON.stringify(complaint) })));
    expect(events.emailRepository.suppress).toHaveBeenCalledWith('org-2', 'bob@example.com', expect.any(String), 'COMPLAINED');
    expect(events.campaignRepository.markDeliveryEvent).not.toHaveBeenCalled();
  });

  it('ignores a temporary bounce, and records a delivery', async () => {
    const events = makeEvents();
    const soft = { eventType: 'Bounce', mail: { messageId: 'ses-1' }, bounce: { bounceType: 'Transient', bouncedRecipients: [{ emailAddress: 'a@example.com' }] } };
    await events.service.receive(JSON.stringify(signed({ Message: JSON.stringify(soft) })));
    expect(events.emailRepository.suppress).not.toHaveBeenCalled();
    await events.service.receive(JSON.stringify(signed({ Message: JSON.stringify({ eventType: 'Delivery', mail: { messageId: 'ses-1' } }) })));
    expect(events.campaignRepository.markDeliveryEvent).toHaveBeenCalledWith('org-1', 'd-1', 'DELIVERED');
  });

  it('refuses a message from another topic, a changed message, and a certificate from elsewhere', async () => {
    const bounce = JSON.stringify({ eventType: 'Complaint', mail: { messageId: 'ses-1' }, complaint: { complainedRecipients: [{ emailAddress: 'a@example.com' }] } });
    const events = makeEvents();
    expect(await events.service.receive(JSON.stringify(signed({ Message: bounce, TopicArn: `${topic}-other` })))).toBe('invalid');
    const changed = signed({ Message: bounce });
    changed.Message = changed.Message.replace('a@example.com', 'b@example.com');
    expect(await events.service.receive(JSON.stringify(changed))).toBe('invalid');
    expect(await events.service.receive(JSON.stringify(signed({ Message: bounce, SigningCertURL: 'https://evil.example/c.pem' })))).toBe('invalid');
    expect(await events.service.receive('not json')).toBe('invalid');
    expect(await events.service.receive('null')).toBe('invalid');
    expect(events.emailRepository.suppress).not.toHaveBeenCalled();
  });

  it('asks SNS to send it again when our database fails', async () => {
    const events = makeEvents();
    events.campaignRepository.deliveryForMessage.mockImplementation(async () => {
      throw new Error('database down');
    });
    const bounce = { eventType: 'Complaint', mail: { messageId: 'ses-1' }, complaint: { complainedRecipients: [{ emailAddress: 'a@example.com' }] } };
    expect(await events.service.receive(JSON.stringify(signed({ Message: JSON.stringify(bounce) })))).toBe('error');
  });

  it('keeps only certificates that checked out a message', async () => {
    const events = makeEvents();
    const forged = signed({ SigningCertURL: `${certUrl}?n=1` });
    forged.Signature = Buffer.from('nope').toString('base64');
    await events.service.receive(JSON.stringify(forged));
    await events.service.receive(JSON.stringify(signed({})));
    await events.service.receive(JSON.stringify(signed({ SigningCertURL: `${certUrl}?n=2` })));
    // the forged one fetched once; the genuine ones share one cached certificate
    expect(events.fetches.filter((u) => u.startsWith(certUrl))).toHaveLength(2);
  });

  it('confirms the subscription from Amazon’s own address only', async () => {
    const events = makeEvents();
    const subscribeUrl = 'https://sns.eu-west-2.amazonaws.com/?Action=ConfirmSubscription&Token=t';
    await events.service.receive(
      JSON.stringify(signed({ Type: 'SubscriptionConfirmation', Message: 'confirm', SubscribeURL: subscribeUrl, Token: 't' }))
    );
    expect(events.fetches).toContain(subscribeUrl);
  });
});
