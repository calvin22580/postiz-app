// OURS: the simulated sender (email campaigns EM2). Records nothing outside
// our own tables and never sends: each delivery is marked SIMULATED, and the
// screens say so.
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import {
  EmailCampaignSender,
  OutgoingEmail,
  SenderSetup,
} from '@gitroom/nestjs-libraries/ours/email/senders/email.sender';

export class SimulatedEmailSender implements EmailCampaignSender {
  readonly name = 'simulated' as const;
  private _logger = new Logger(SimulatedEmailSender.name);

  async prepare(): Promise<SenderSetup | null> {
    return null;
  }

  async send(email: OutgoingEmail) {
    const messageId = `simulated-${randomUUID()}`;
    this._logger.log(
      `[SIMULATED - NOT SENT] org=${email.organizationId} subject="${email.subject.slice(0, 60)}" id=${messageId}`
    );
    return { messageId };
  }
}
