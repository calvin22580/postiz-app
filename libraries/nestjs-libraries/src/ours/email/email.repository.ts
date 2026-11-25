// OURS: the email list's tables (email campaigns EM1). Every query is scoped
// by organizationId, except finding a contact from its unsubscribe token,
// where the signed token is the proof and every write after it is scoped by
// the contact's own organisation.
import { Injectable } from '@nestjs/common';
import {
  OursEmailContactBasis,
  OursEmailContactSource,
  OursEmailContactStatus,
  Prisma,
} from '@prisma/client';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { ACTIVE_STATUSES } from '@gitroom/nestjs-libraries/ours/email/email.contacts';

export const CONTACTS_PAGE = 50;

const contactSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  basis: true,
  source: true,
  consentAt: true,
  statusChangedAt: true,
  createdAt: true,
} satisfies Prisma.OursEmailContactSelect;

export interface NewContact {
  email: string;
  name: string | null;
  basis: OursEmailContactBasis;
  source: OursEmailContactSource;
  status?: OursEmailContactStatus;
  importId?: string | null;
}

@Injectable()
export class EmailRepository {
  constructor(
    private _contact: PrismaRepository<'oursEmailContact'>,
    private _import: PrismaRepository<'oursEmailImport'>,
    private _suppression: PrismaRepository<'oursEmailSuppression'>,
    private _form: PrismaRepository<'oursEmailForm'>,
    private _organization: PrismaRepository<'organization'>
  ) {}

  async countsByStatus(orgId: string) {
    const rows = await this._contact.model.oursEmailContact.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Partial<
      Record<OursEmailContactStatus, number>
    >;
  }

  listContacts(
    orgId: string,
    options: { search?: string; statuses?: OursEmailContactStatus[]; page: number }
  ) {
    const where: Prisma.OursEmailContactWhereInput = {
      organizationId: orgId,
      ...(options.statuses?.length ? { status: { in: options.statuses } } : {}),
      ...(options.search
        ? {
            OR: [
              { email: { contains: options.search, mode: 'insensitive' } },
              { name: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return Promise.all([
      this._contact.model.oursEmailContact.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: options.page * CONTACTS_PAGE,
        take: CONTACTS_PAGE,
        select: contactSelect,
      }),
      this._contact.model.oursEmailContact.count({ where }),
    ]);
  }

  // the whole list, oldest first, for the owner's own download
  exportContacts(orgId: string) {
    return this._contact.model.oursEmailContact.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: contactSelect,
    });
  }

  async existingEmails(orgId: string, emails: string[]) {
    const rows = await this._contact.model.oursEmailContact.findMany({
      where: { organizationId: orgId, email: { in: emails } },
      select: { email: true },
    });
    return new Set(rows.map((r) => r.email));
  }

  async suppressedHashes(orgId: string, hashes: string[]) {
    const rows = await this._suppression.model.oursEmailSuppression.findMany({
      where: { organizationId: orgId, emailHash: { in: hashes } },
      select: { emailHash: true },
    });
    return new Set(rows.map((r) => r.emailHash));
  }

  async isSuppressed(orgId: string, hash: string) {
    return !!(await this._suppression.model.oursEmailSuppression.findUnique({
      where: { organizationId_emailHash: { organizationId: orgId, emailHash: hash } },
      select: { id: true },
    }));
  }

  createImport(
    orgId: string,
    data: { userId: string; fileName: string | null; basis: OursEmailContactBasis; statement: string }
  ) {
    return this._import.model.oursEmailImport.create({
      data: { ...data, organizationId: orgId },
      select: { id: true },
    });
  }

  finishImport(
    orgId: string,
    id: string,
    counts: { added: number; alreadyOnList: number; invalid: number; blocked: number; overLimit: number }
  ) {
    return this._import.model.oursEmailImport.updateMany({
      where: { id, organizationId: orgId },
      data: counts,
    });
  }

  // Adds new addresses; one already on the list (even added a moment ago by
  // someone else) is skipped, never changed. Returns how many were added.
  async createContacts(orgId: string, contacts: NewContact[]) {
    if (!contacts.length) {
      return 0;
    }
    const { count } = await this._contact.model.oursEmailContact.createMany({
      data: contacts.map((c) => ({ ...c, organizationId: orgId })),
      skipDuplicates: true,
    });
    return count;
  }

  getContact(orgId: string, id: string) {
    return this._contact.model.oursEmailContact.findFirst({
      where: { id, organizationId: orgId },
      select: contactSelect,
    });
  }

  getContactByEmail(orgId: string, email: string) {
    return this._contact.model.oursEmailContact.findUnique({
      where: { organizationId_email: { organizationId: orgId, email } },
      select: contactSelect,
    });
  }

  // From an unsubscribe token: the signature has already been checked.
  contactForToken(id: string) {
    return this._contact.model.oursEmailContact.findUnique({
      where: { id },
      select: { id: true, organizationId: true, email: true, status: true },
    });
  }

  deleteContact(orgId: string, id: string) {
    return this._contact.model.oursEmailContact.deleteMany({
      where: { id, organizationId: orgId },
    });
  }

  // Stops all email to this address from this business, for good: the
  // contact (if still on the list) and a block that outlives it.
  async suppress(
    orgId: string,
    email: string,
    hash: string,
    status: Extract<OursEmailContactStatus, 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED'>
  ) {
    const now = new Date();
    await this._contact.model.oursEmailContact.updateMany({
      where: { organizationId: orgId, email, status: { in: ACTIVE_STATUSES } },
      data: { status, statusChangedAt: now },
    });
    await this._suppression.model.oursEmailSuppression.upsert({
      where: { organizationId_emailHash: { organizationId: orgId, emailHash: hash } },
      create: { organizationId: orgId, emailHash: hash, reason: status.toLowerCase() },
      update: {},
      select: { id: true },
    });
  }

  getForm(orgId: string) {
    return this._form.model.oursEmailForm.findUnique({
      where: { organizationId: orgId },
      select: { publicId: true, enabled: true },
    });
  }

  saveForm(orgId: string, publicId: string, enabled: boolean) {
    return this._form.model.oursEmailForm.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, publicId, enabled },
      update: { enabled },
      select: { publicId: true, enabled: true },
    });
  }

  formByPublicId(publicId: string) {
    return this._form.model.oursEmailForm.findUnique({
      where: { publicId },
      select: { organizationId: true, enabled: true },
    });
  }

  // the organisation's own name, for when the profile has no business name;
  // null for a deleted organisation
  async organisationName(orgId: string) {
    const org = await this._organization.model.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { name: true },
    });
    return org ? org.name : null;
  }
}
