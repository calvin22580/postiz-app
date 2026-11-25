// OURS: the business's email list (email campaigns EM1). Contacts, the
// consent behind each one, the sign-up form and unsubscribing. Nothing is
// sent from here yet: sending is EM2, and confirmation emails for form
// sign-ups come with it.
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { OursEmailContactBasis, OursEmailContactStatus } from '@prisma/client';
import {
  CONTACTS_PAGE,
  EmailRepository,
  NewContact,
} from '@gitroom/nestjs-libraries/ours/email/email.repository';
import {
  ACTIVE_STATUSES,
  EMAIL_BASES,
  EmailBasisKey,
  emailHash,
  isValidEmail,
  MAX_NAME_LENGTH,
  MAX_UPLOAD_BYTES,
  normaliseEmail,
  ParsedList,
  parseContactsCsv,
  parsePastedContacts,
  readUnsubscribeToken,
  REFUSED_BASIS,
  REFUSED_BASIS_MESSAGE,
} from '@gitroom/nestjs-libraries/ours/email/email.contacts';
import { PlanService, PLAN_LIMIT_STATUS } from '@gitroom/nestjs-libraries/ours/plans/plan.service';
import { BusinessProfileService } from '@gitroom/nestjs-libraries/ours/profile/business.profile.service';
import { ProfileFields } from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';

// Shown on the business's sign-up form next to the box the person ticks.
// This wording is the record of what they agreed to (with the date on the
// contact), so change it only with a new version of the form.
export const formConsentSentence = (business: string) =>
  `Yes, I’d like to get emails from ${business} with news and offers. I can unsubscribe at any time.`;

const STATUS_FILTERS: Record<string, OursEmailContactStatus[]> = {
  subscribed: ['SUBSCRIBED'],
  waiting: ['PENDING_CONFIRMATION'],
  unsubscribed: ['UNSUBSCRIBED'],
  blocked: ['BOUNCED', 'COMPLAINED'],
};

// A cell for the owner's CSV download. A leading = + - @ is neutralised so a
// spreadsheet never runs a contact's name as a formula.
const csvCell = (value: string | null | undefined) => {
  let text = value ?? '';
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const frontendUrl = () => (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

export interface ImportRequest {
  basis: string;
  // the owner ticked the statement shown for that basis
  confirmed: boolean;
  fileName?: string | null;
  // a CSV file's text, or addresses typed or pasted into a box
  csv?: string | null;
  text?: string | null;
}

@Injectable()
export class EmailService {
  private _logger = new Logger(EmailService.name);

  constructor(
    private _emailRepository: EmailRepository,
    private _planService: PlanService,
    private _businessProfileService: BusinessProfileService
  ) {}

  // The business's name as its customers know it: the profile's, or the
  // organisation's own name until there is a profile.
  async businessName(orgId: string) {
    try {
      const { profile } = await this._businessProfileService.getProfile(orgId);
      const fields = profile?.fields as ProfileFields | undefined;
      const name = fields?.businessName?.claims?.[0]?.value?.trim();
      if (name) {
        return name;
      }
    } catch (e) {
      this._logger.warn(`No profile name for org=${orgId}: ${(e as Error).message}`);
    }
    return (await this._emailRepository.organisationName(orgId)) || 'this business';
  }

  async overview(orgId: string) {
    const [counts, business, form, plan] = await Promise.all([
      this._emailRepository.countsByStatus(orgId),
      this.businessName(orgId),
      this._emailRepository.getForm(orgId),
      this._planService.current(orgId),
    ]);
    const subscribed = counts.SUBSCRIBED || 0;
    const waiting = counts.PENDING_CONFIRMATION || 0;
    return {
      businessName: business,
      counts: {
        subscribed,
        waiting,
        unsubscribed: counts.UNSUBSCRIBED || 0,
        blocked: (counts.BOUNCED || 0) + (counts.COMPLAINED || 0),
      },
      limit: { used: subscribed + waiting, limit: plan.plan.limits.contacts },
      bases: EMAIL_BASES.map((b) => ({ key: b.key, label: b.label, statement: b.statement(business) })),
      form: {
        enabled: !!form?.enabled,
        url: form ? `${frontendUrl()}/subscribe.html?f=${form.publicId}` : null,
        consent: formConsentSentence(business),
      },
    };
  }

  async listContacts(orgId: string, query: { search?: string; status?: string; page?: number }) {
    const page = Math.max(0, Math.floor(Number(query.page) || 0));
    const [contacts, total] = await this._emailRepository.listContacts(orgId, {
      search: (query.search || '').trim().slice(0, 100) || undefined,
      statuses: STATUS_FILTERS[query.status || ''],
      page,
    });
    return { contacts, total, page, pageSize: CONTACTS_PAGE };
  }

  // One person, typed in by the owner.
  async addContact(orgId: string, body: { email: string; name?: string; basis: string }) {
    const basis = this.basisOrRefuse(body.basis);
    const email = normaliseEmail(body.email || '');
    if (!isValidEmail(email)) {
      throw new HttpException('That doesn’t look like an email address.', 400);
    }
    if (await this._emailRepository.isSuppressed(orgId, emailHash(email))) {
      throw new HttpException(
        'This person unsubscribed or their address stopped working, so we can’t add them again.',
        400
      );
    }
    if (await this._emailRepository.getContactByEmail(orgId, email)) {
      throw new HttpException('This person is already on your list.', 400);
    }
    const { room, message } = await this._planService.contactRoom(orgId);
    if (room < 1) {
      throw new HttpException(message, PLAN_LIMIT_STATUS);
    }
    const name = (body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) || null;
    await this._emailRepository.createContacts(orgId, [{ email, name, basis, source: 'MANUAL' }]);
    return this.overview(orgId);
  }

  // A spreadsheet, or addresses pasted into a box. The owner first says how
  // these people gave their address; "bought list, or other" is refused.
  async importContacts(orgId: string, userId: string, body: ImportRequest) {
    const basis = this.basisOrRefuse(body.basis);
    if (!body.confirmed) {
      throw new HttpException('Please tick the statement to confirm where these addresses came from.', 400);
    }
    const raw = body.csv ?? body.text ?? '';
    if (!raw.trim()) {
      throw new HttpException('There were no addresses to add.', 400);
    }
    if (Buffer.byteLength(raw, 'utf8') > MAX_UPLOAD_BYTES) {
      throw new HttpException('That file is too big. Please upload up to 5 MB at a time.', 400);
    }
    const parsed: ParsedList = body.csv != null ? parseContactsCsv(raw) : parsePastedContacts(raw);
    if (!parsed.contacts.length) {
      throw new HttpException(
        body.csv != null
          ? 'We couldn’t find any email addresses in that file. It needs a column headed “Email”.'
          : 'We couldn’t find any email addresses there.',
        400
      );
    }

    const business = await this.businessName(orgId);
    const statement = EMAIL_BASES.find((b) => b.key === basis)!.statement(business);
    const { room, message } = await this._planService.contactRoom(orgId);

    const emails = parsed.contacts.map((c) => c.email);
    const [blockedHashes, existing] = await Promise.all([
      this._emailRepository.suppressedHashes(orgId, emails.map(emailHash)),
      this._emailRepository.existingEmails(orgId, emails),
    ]);
    const isBlocked = (email: string) => blockedHashes.has(emailHash(email));
    const fresh = parsed.contacts.filter((c) => !existing.has(c.email) && !isBlocked(c.email));
    const blocked = parsed.contacts.filter((c) => isBlocked(c.email)).length;
    const onList = parsed.contacts.filter((c) => existing.has(c.email) && !isBlocked(c.email)).length;
    const toAdd = fresh.slice(0, room);

    const importRow = await this._emailRepository.createImport(orgId, {
      userId,
      fileName: body.csv != null ? (body.fileName || 'upload.csv').slice(0, 200) : null,
      basis,
      statement,
    });
    const added = await this._emailRepository.createContacts(
      orgId,
      toAdd.map(
        (c): NewContact => ({ email: c.email, name: c.name, basis, source: 'IMPORT', importId: importRow.id })
      )
    );
    const counts = {
      added,
      // includes anyone added by someone else while this upload ran
      alreadyOnList: onList + (toAdd.length - added),
      invalid: parsed.invalid + parsed.tooMany,
      blocked,
      overLimit: fresh.length - toAdd.length,
    };
    await this._emailRepository.finishImport(orgId, importRow.id, counts);

    return {
      result: {
        ...counts,
        duplicatesInFile: parsed.duplicates,
        tooManyRows: parsed.tooMany,
        limitMessage: counts.overLimit ? message : null,
      },
      overview: await this.overview(orgId),
    };
  }

  async deleteContact(orgId: string, id: string) {
    const { count } = await this._emailRepository.deleteContact(orgId, id);
    if (!count) {
      throw new HttpException('That person isn’t on your list.', 404);
    }
    return this.overview(orgId);
  }

  // The owner's own list as a CSV file.
  async exportCsv(orgId: string) {
    const rows = await this._emailRepository.exportContacts(orgId);
    const lines = [
      ['Email', 'Name', 'Status', 'How they agreed', 'Added by', 'Agreed on', 'Added on'],
      ...rows.map((c) => [
        c.email,
        c.name,
        c.status.toLowerCase().replace(/_/g, ' '),
        c.basis === 'CONSENT' ? 'consent' : 'soft opt-in',
        c.source.toLowerCase(),
        c.consentAt.toISOString().slice(0, 10),
        c.createdAt.toISOString().slice(0, 10),
      ]),
    ];
    // the BOM lets Excel read names with accents correctly
    return '\uFEFF' + lines.map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  async setForm(orgId: string, enabled: boolean) {
    const current = await this._emailRepository.getForm(orgId);
    await this._emailRepository.saveForm(orgId, current?.publicId || randomBytes(12).toString('base64url'), enabled);
    return this.overview(orgId);
  }

  // --- public: no sign-in ---

  // What the sign-up page shows. 404 for a form that is off or unknown.
  async formInfo(publicId: string) {
    const form = await this._emailRepository.formByPublicId(publicId);
    if (!form?.enabled || !(await this._emailRepository.organisationName(form.organizationId))) {
      throw new HttpException('This sign-up form isn’t available.', 404);
    }
    const business = await this.businessName(form.organizationId);
    return { businessName: business, consent: formConsentSentence(business) };
  }

  // Someone signing up on the business's form. They wait for confirmation by
  // email (sent from EM2) before they are emailed anything. The answer never
  // says whether the address was already known.
  async signUp(publicId: string, body: { email: string; name?: string; consent: boolean; website?: string }) {
    // a filled-in hidden field means a bot: look successful, do nothing
    if (body.website) {
      return { ok: true };
    }
    const form = await this._emailRepository.formByPublicId(publicId);
    if (!form?.enabled || !(await this._emailRepository.organisationName(form.organizationId))) {
      throw new HttpException('This sign-up form isn’t available.', 404);
    }
    if (!body.consent) {
      throw new HttpException('Please tick the box to say you’d like these emails.', 400);
    }
    const email = normaliseEmail(body.email || '');
    if (!isValidEmail(email)) {
      throw new HttpException('That doesn’t look like an email address.', 400);
    }
    const orgId = form.organizationId;
    if (
      (await this._emailRepository.isSuppressed(orgId, emailHash(email))) ||
      (await this._emailRepository.getContactByEmail(orgId, email))
    ) {
      return { ok: true };
    }
    try {
      const { room } = await this._planService.contactRoom(orgId);
      if (room < 1) {
        throw new Error('list full');
      }
    } catch {
      this._logger.warn(`Sign-up refused for org=${orgId}: list full or plan ended`);
      throw new HttpException('Sorry, you can’t sign up right now. Please try again later.', 400);
    }
    const name = (body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) || null;
    await this._emailRepository.createContacts(orgId, [
      { email, name, basis: 'CONSENT', source: 'FORM', status: 'PENDING_CONFIRMATION' },
    ]);
    return { ok: true };
  }

  // What the unsubscribe page shows. 404 for a link that isn't ours, or
  // whose contact the owner has removed.
  async unsubscribeInfo(token: string) {
    const contact = await this.contactForToken(token);
    if (!contact) {
      throw new HttpException('This unsubscribe link isn’t valid.', 404);
    }
    return {
      businessName: await this.businessName(contact.organizationId),
      unsubscribed: !ACTIVE_STATUSES.includes(contact.status),
    };
  }

  // The unsubscribe button, and the one-click unsubscribe mail apps send
  // (RFC 8058). Never throws: answers whether the link was one of ours.
  async unsubscribe(token: string) {
    try {
      const contact = await this.contactForToken(token);
      if (!contact) {
        return false;
      }
      await this._emailRepository.suppress(
        contact.organizationId,
        contact.email,
        emailHash(contact.email),
        'UNSUBSCRIBED'
      );
      this._logger.log(`Unsubscribed contact=${contact.id} org=${contact.organizationId}`);
      return true;
    } catch (e) {
      this._logger.error(`Unsubscribe failed: ${(e as Error).message}`);
      return false;
    }
  }

  private async contactForToken(token: string) {
    const id = readUnsubscribeToken(token);
    return id ? this._emailRepository.contactForToken(id) : null;
  }

  private basisOrRefuse(value: string): OursEmailContactBasis {
    if (value === REFUSED_BASIS) {
      throw new HttpException(REFUSED_BASIS_MESSAGE, 400);
    }
    const basis = EMAIL_BASES.find((b) => b.key === value)?.key as EmailBasisKey | undefined;
    if (!basis) {
      throw new HttpException('Please choose how these people gave you their address.', 400);
    }
    return basis;
  }
}
