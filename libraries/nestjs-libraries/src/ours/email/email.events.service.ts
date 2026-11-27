// OURS: what Amazon SES tells us after a list email goes (email campaigns
// EM2). Each business's configuration set publishes bounce, complaint,
// delivery and reject events to an SNS topic (OURS_EMAIL_SNS_TOPIC_ARN),
// which posts them to /ours/email/events. A permanent bounce or a complaint
// blocks that address for that business for good.
//
// Called by an external system, so nothing here throws: every failure is
// caught and logged, and reported as 'error' so SNS tries again later. Messages are only acted on when Amazon's signature
// checks out and they come from our own topic.
// SNS message format and signing: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
import { Injectable, Logger } from '@nestjs/common';
import { createVerify } from 'node:crypto';
import { EmailRepository } from '@gitroom/nestjs-libraries/ours/email/email.repository';
import { EmailCampaignRepository } from '@gitroom/nestjs-libraries/ours/email/email.campaign.repository';
import { emailHash, isValidEmail, normaliseEmail } from '@gitroom/nestjs-libraries/ours/email/email.contacts';

export interface SnsMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
}

const NOTIFICATION_KEYS = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'] as const;
const SUBSCRIPTION_KEYS = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'] as const;

// Only Amazon's own SNS hosts, over https.
export const isSnsUrl = (value: string | undefined, pathEnd?: string) => {
  try {
    const url = new URL(value || '');
    return (
      url.protocol === 'https:' &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname) &&
      (!pathEnd || url.pathname.endsWith(pathEnd))
    );
  } catch {
    return false;
  }
};

// The text Amazon signed: chosen keys in order, each "Key\nValue\n".
export const snsStringToSign = (message: SnsMessage) => {
  const keys = message.Type === 'Notification' ? NOTIFICATION_KEYS : SUBSCRIPTION_KEYS;
  return keys
    .filter((key) => message[key] !== undefined)
    .map((key) => `${key}\n${message[key]}\n`)
    .join('');
};

export const verifySnsSignature = (message: SnsMessage, certificatePem: string) => {
  const algorithm = message.SignatureVersion === '2' ? 'RSA-SHA256' : message.SignatureVersion === '1' ? 'RSA-SHA1' : '';
  if (!algorithm) {
    return false;
  }
  try {
    return createVerify(algorithm).update(snsStringToSign(message), 'utf8').verify(certificatePem, message.Signature, 'base64');
  } catch {
    return false;
  }
};

interface SesEvent {
  eventType?: string;
  mail?: { messageId?: string; tags?: Record<string, string[]> };
  bounce?: { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] };
  complaint?: { complainedRecipients?: { emailAddress?: string }[] };
}

@Injectable()
export class EmailEventsService {
  private _logger = new Logger(EmailEventsService.name);
  private _certificates = new Map<string, string>();
  // replaced in tests
  _fetch: (url: string) => Promise<Response> = (url) => fetch(url);

  constructor(
    private _emailRepository: EmailRepository,
    private _campaignRepository: EmailCampaignRepository
  ) {}

  // Never throws. 'invalid': not ours or not genuine. 'error': ours, but we
  // couldn't act on it now (SNS retries a server error, not a refusal).
  async receive(raw: string | undefined): Promise<'ok' | 'invalid' | 'error'> {
    let message: SnsMessage;
    try {
      message = JSON.parse(raw || '') as SnsMessage;
      const topic = (process.env.OURS_EMAIL_SNS_TOPIC_ARN || '').trim();
      if (!topic || message?.TopicArn !== topic || !(await this.genuine(message))) {
        this._logger.warn(`Ignored an email event that isn't from our topic or isn't signed by Amazon`);
        return 'invalid';
      }
    } catch (e) {
      this._logger.warn(`Ignored an email event that couldn't be read: ${(e as Error)?.message}`);
      return 'invalid';
    }
    try {
      if (message.Type === 'SubscriptionConfirmation') {
        if (isSnsUrl(message.SubscribeURL)) {
          await this._fetch(message.SubscribeURL!);
          this._logger.log(`Confirmed the SNS subscription to ${message.TopicArn}`);
        }
        return 'ok';
      }
      if (message.Type === 'Notification') {
        await this.handle(JSON.parse(message.Message) as SesEvent);
      }
      return 'ok';
    } catch (e) {
      this._logger.error(`Email event not handled: ${(e as Error)?.message}`);
      return 'error';
    }
  }

  // Amazon's certificates are kept once they've checked out a message, a few
  // at most, so made-up certificate addresses can't fill memory.
  private async genuine(message: SnsMessage) {
    if (!isSnsUrl(message.SigningCertURL, '.pem')) {
      return false;
    }
    const url = new URL(message.SigningCertURL);
    const key = `${url.origin}${url.pathname}`;
    const cached = this._certificates.get(key);
    if (cached) {
      return verifySnsSignature(message, cached);
    }
    const res = await this._fetch(message.SigningCertURL);
    if (!res.ok) {
      return false;
    }
    const certificate = await res.text();
    if (!verifySnsSignature(message, certificate)) {
      return false;
    }
    if (this._certificates.size >= 10) {
      this._certificates.clear();
    }
    this._certificates.set(key, certificate);
    return true;
  }

  private async handle(event: SesEvent) {
    const messageId = event.mail?.messageId;
    const delivery = messageId ? await this._campaignRepository.deliveryForMessage(messageId) : null;
    // our own tag, set when we sent it (confirmation emails have no delivery row)
    const orgId = delivery?.organizationId || event.mail?.tags?.organization?.[0];
    if (!orgId) {
      return;
    }
    const permanentBounce = event.eventType === 'Bounce' && event.bounce?.bounceType === 'Permanent';
    const complaint = event.eventType === 'Complaint';
    if (event.eventType === 'Delivery' && delivery) {
      await this._campaignRepository.markDeliveryEvent(orgId, delivery.id, 'DELIVERED');
      return;
    }
    if (!permanentBounce && !complaint) {
      return;
    }
    const status = complaint ? 'COMPLAINED' : 'BOUNCED';
    const recipients = (complaint ? event.complaint?.complainedRecipients : event.bounce?.bouncedRecipients) || [];
    for (const recipient of recipients) {
      const email = normaliseEmail(recipient.emailAddress || '');
      if (isValidEmail(email)) {
        await this._emailRepository.suppress(orgId, email, emailHash(email), status);
        this._logger.log(`Blocked an address for org=${orgId}: ${status.toLowerCase()}`);
      }
    }
    if (delivery) {
      await this._campaignRepository.markDeliveryEvent(orgId, delivery.id, status);
    }
  }
}
