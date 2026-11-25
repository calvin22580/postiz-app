// OURS: how list emails leave Kanosena (email campaigns EM2). One interface,
// two senders: Amazon SES, and a simulated one that records who would have
// got each email and never sends (tests, demos, and the default until SES
// is set up). Chosen by OURS_EMAIL_SENDER: off (default), simulated or ses.

export interface OutgoingEmail {
  organizationId: string;
  to: string;
  fromName: string;
  fromAddress: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  // List-Unsubscribe and friends
  headers: Record<string, string>;
  // what the sender's events carry back to us (SES message tags)
  tags: Record<string, string>;
  // the business's own set-up at the sender, from prepare()
  setup?: SenderSetup | null;
}

export interface SenderSetup {
  tenantName: string;
  configurationSet: string;
}

export interface EmailCampaignSender {
  readonly name: 'simulated' | 'ses';
  // Makes the business's own space at the sender, the first time it sends.
  // Null when the sender needs none.
  prepare(organizationId: string): Promise<SenderSetup | null>;
  send(email: OutgoingEmail): Promise<{ messageId: string }>;
}

// retry: try this message again later (throttled, sender down)
// reject: this message will never go (address or content refused)
// paused: the sender has stopped this business or our account; stop sending
// unknown: it may or may not have gone (a timeout, a dropped connection), so
//   it is never sent again
export class EmailSenderError extends Error {
  constructor(message: string, public kind: 'retry' | 'reject' | 'paused' | 'unknown') {
    super(message);
  }
}
