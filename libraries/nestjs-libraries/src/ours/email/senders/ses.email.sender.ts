// OURS: sends list emails through Amazon SES v2 (email campaigns EM2), in
// OURS_EMAIL_SES_REGION (London, eu-west-2), with our own OURS_EMAIL_AWS_*
// keys so upstream's SES email provider (SES_*) is never switched on by this.
// Each business gets its own SES tenant and configuration set, so one bad
// sender's bounces and complaints can't hurt the others, and events reach us
// through the configuration set's SNS destination.
import {
  CreateConfigurationSetCommand,
  CreateConfigurationSetEventDestinationCommand,
  CreateTenantCommand,
  CreateTenantResourceAssociationCommand,
  SendEmailCommand,
  SESv2Client,
} from '@aws-sdk/client-sesv2';
import {
  EmailCampaignSender,
  EmailSenderError,
  OutgoingEmail,
  SenderSetup,
} from '@gitroom/nestjs-libraries/ours/email/senders/email.sender';

// SES refused these before taking the message, so they surely didn't go
const RETRY = new Set(['TooManyRequestsException', 'LimitExceededException', 'ThrottlingException']);
const REJECTED = new Set(['MessageRejected', 'BadRequestException', 'NotFoundException']);
const PAUSED = new Set([
  'SendingPausedException',
  'AccountSuspendedException',
  'MailFromDomainNotVerifiedException',
]);

// SES only accepts 7-bit ASCII in the From address, so a non-ASCII name is a
// MIME encoded-word (RFC 2047), as in upstream's SES provider
export const fromHeader = (name: string, address: string) => {
  const display = /^[\x20-\x7e]*$/.test(name)
    ? `"${name.replace(/["\\]/g, '\\$&')}"`
    : `=?UTF-8?B?${Buffer.from(name).toString('base64')}?=`;
  return `${display} <${address}>`;
};

const errorName = (e: unknown) => (e as { name?: string })?.name || '';
const alreadyExists = (e: unknown) => errorName(e) === 'AlreadyExistsException';

export class SesEmailSender implements EmailCampaignSender {
  readonly name = 'ses' as const;

  constructor(
    private _client = new SESv2Client({
      region: process.env.OURS_EMAIL_SES_REGION || 'eu-west-2',
      // well inside the send loop's two-minute lease
      requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
      ...(process.env.OURS_EMAIL_AWS_ACCESS_KEY_ID
        ? {
            credentials: {
              accessKeyId: process.env.OURS_EMAIL_AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.OURS_EMAIL_AWS_SECRET_ACCESS_KEY || '',
            },
          }
        : {}),
    }),
    private _env: NodeJS.ProcessEnv = process.env
  ) {}

  // Each step is skipped when it already exists, so a half-finished set-up
  // is completed next time.
  async prepare(organizationId: string): Promise<SenderSetup> {
    const prefix = (this._env.OURS_EMAIL_TENANT_PREFIX || 'kanosena').trim();
    const tenantName = `${prefix}-${organizationId}`.slice(0, 64);
    const configurationSet = tenantName;
    const identityArn = this._env.OURS_EMAIL_SES_IDENTITY_ARN || '';
    const topicArn = this._env.OURS_EMAIL_SNS_TOPIC_ARN || '';
    const ignoreExisting = (e: unknown) => {
      if (!alreadyExists(e)) throw e;
    };
    await this._client
      .send(new CreateTenantCommand({ TenantName: tenantName, Tags: [{ Key: 'organization', Value: organizationId }] }))
      .catch(ignoreExisting);
    await this._client
      .send(new CreateConfigurationSetCommand({ ConfigurationSetName: configurationSet }))
      .catch(ignoreExisting);
    if (topicArn) {
      await this._client
        .send(
          new CreateConfigurationSetEventDestinationCommand({
            ConfigurationSetName: configurationSet,
            EventDestinationName: 'kanosena-events',
            EventDestination: {
              Enabled: true,
              MatchingEventTypes: ['BOUNCE', 'COMPLAINT', 'DELIVERY', 'REJECT'],
              SnsDestination: { TopicArn: topicArn },
            },
          })
        )
        .catch(ignoreExisting);
    }
    if (identityArn) {
      const configurationSetArn = identityArn.replace(/identity\/.*$/, `configuration-set/${configurationSet}`);
      for (const ResourceArn of [identityArn, configurationSetArn]) {
        await this._client
          .send(new CreateTenantResourceAssociationCommand({ TenantName: tenantName, ResourceArn }))
          .catch(ignoreExisting);
      }
    }
    return { tenantName, configurationSet };
  }

  async send(email: OutgoingEmail) {
    try {
      const result = await this._client.send(
        new SendEmailCommand({
          FromEmailAddress: fromHeader(email.fromName, email.fromAddress),
          Destination: { ToAddresses: [email.to] },
          ...(email.replyTo ? { ReplyToAddresses: [email.replyTo] } : {}),
          Content: {
            Simple: {
              Subject: { Data: email.subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: email.html, Charset: 'UTF-8' },
                Text: { Data: email.text, Charset: 'UTF-8' },
              },
              Headers: Object.entries(email.headers).map(([Name, Value]) => ({ Name, Value })),
            },
          },
          EmailTags: Object.entries(email.tags).map(([Name, Value]) => ({ Name, Value })),
          ...(email.setup
            ? { ConfigurationSetName: email.setup.configurationSet, TenantName: email.setup.tenantName }
            : {}),
        })
      );
      return { messageId: result.MessageId || '' };
    } catch (e) {
      const name = errorName(e);
      const message = `${name || 'Error'}: ${(e as Error)?.message || ''}`.slice(0, 300);
      const kind = PAUSED.has(name) ? 'paused' : REJECTED.has(name) ? 'reject' : RETRY.has(name) ? 'retry' : 'unknown';
      throw new EmailSenderError(message, kind);
    }
  }
}
