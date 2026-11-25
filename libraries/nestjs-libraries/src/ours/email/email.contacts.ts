// OURS: email list helpers (email campaigns EM1). Reading an uploaded or
// pasted list, and the unsubscribe link's token. No database access here.
//
// The rules come from the ICO's PECR guidance on marketing by electronic mail
// (checked 25/11/2026): marketing email to individuals needs consent, or the
// "soft opt-in" for the business's own customers who could opt out when they
// gave their address. Bought or third-party lists never qualify.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { isEmail } from 'class-validator';
import { OursEmailContactStatus } from '@prisma/client';

// contacts we may email, or who are waiting to confirm: what the plan counts
export const ACTIVE_STATUSES: OursEmailContactStatus[] = ['SUBSCRIBED', 'PENDING_CONFIRMATION'];

// What the owner tells us about where an upload's addresses came from. The
// statement is stored word for word with the upload.
export const EMAIL_BASES = [
  {
    key: 'CONSENT',
    label: 'They signed up to hear from us',
    statement: (business: string) =>
      `I confirm everyone on this list asked to receive emails from ${business}, and I can show when and how they did.`,
  },
  {
    key: 'SOFT_OPT_IN',
    label: 'They bought from us, or asked for a quote, and could opt out',
    statement: (business: string) =>
      `I confirm ${business} collected these addresses itself when people bought from us or asked about buying, they were offered a way to say no to marketing at the time, and we will only email them about our own similar products and services.`,
  },
] as const;

export type EmailBasisKey = (typeof EMAIL_BASES)[number]['key'];

// the third choice on the upload screen; never accepted
export const REFUSED_BASIS = 'OTHER';
export const REFUSED_BASIS_MESSAGE =
  'We can’t add these. UK law (PECR) only allows marketing emails to people who asked to hear from you, or to your own recent customers who could opt out. Bought or borrowed lists never count, even if the seller says they do.';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_ROWS = 20000;
export const MAX_NAME_LENGTH = 120;

export const normaliseEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) =>
  value.length <= 254 && isEmail(value, { allow_display_name: false, require_tld: true });

// What we keep for a blocked address: enough to recognise it again, not the
// address itself.
export const emailHash = (email: string) =>
  createHash('sha256').update(normaliseEmail(email)).digest('hex');

export interface ParsedContact {
  email: string;
  name: string | null;
}

export interface ParsedList {
  contacts: ParsedContact[];
  // rows or entries that had no usable address
  invalid: number;
  // the same address more than once in this upload
  duplicates: number;
  // rows past MAX_UPLOAD_ROWS, not read
  tooMany: number;
}

const EMAIL_HEADER = /^(e-?mail|e-?mail address|email_address|emailaddress)$/i;
const NAME_HEADER = /^(name|full name|full_name|fullname|contact name|customer name)$/i;
const FIRST_NAME_HEADER = /^(first name|first_name|firstname|forename|given name)$/i;
const LAST_NAME_HEADER = /^(last name|last_name|lastname|surname|family name)$/i;

const cleanName = (value: string | undefined | null) => {
  const name = (value || '').replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, MAX_NAME_LENGTH) : null;
};

// Collects each valid address once, counting what was left out.
const collect = (entries: ParsedContact[], invalid: number, tooMany: number): ParsedList => {
  const seen = new Set<string>();
  const contacts: ParsedContact[] = [];
  let duplicates = 0;
  for (const entry of entries) {
    const email = normaliseEmail(entry.email);
    if (!isValidEmail(email)) {
      invalid++;
      continue;
    }
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    contacts.push({ email, name: cleanName(entry.name) });
  }
  return { contacts, invalid, duplicates, tooMany };
};

// A spreadsheet saved as CSV (commas, semicolons or tabs). The address column
// is the one headed "Email" (or similar); without a header row, the first
// column holding an address. A name comes from a "Name" column, or "First
// name" and "Last name". The file is the owner's upload: read as data only.
export const parseContactsCsv = (text: string): ParsedList => {
  let rows: string[][];
  try {
    rows = parse(text, {
      bom: true,
      delimiter: [',', ';', '\t'],
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
  } catch {
    return { contacts: [], invalid: 0, duplicates: 0, tooMany: 0 };
  }
  if (!rows.length) {
    return { contacts: [], invalid: 0, duplicates: 0, tooMany: 0 };
  }

  const header = rows[0].map((cell) => (cell || '').trim());
  let emailCol = header.findIndex((cell) => EMAIL_HEADER.test(cell));
  const hasHeader = emailCol >= 0;
  if (!hasHeader) {
    // no header: the first column with an address in the first few rows
    const sample = rows.slice(0, 20);
    const width = Math.max(...sample.map((r) => r.length));
    emailCol = [...Array(width).keys()].find((col) =>
      sample.some((r) => isValidEmail(normaliseEmail(r[col] || '')))
    ) ?? -1;
  }
  if (emailCol < 0) {
    return { contacts: [], invalid: rows.length - (hasHeader ? 1 : 0), duplicates: 0, tooMany: 0 };
  }
  const nameCol = hasHeader ? header.findIndex((cell) => NAME_HEADER.test(cell)) : -1;
  const firstCol = hasHeader ? header.findIndex((cell) => FIRST_NAME_HEADER.test(cell)) : -1;
  const lastCol = hasHeader ? header.findIndex((cell) => LAST_NAME_HEADER.test(cell)) : -1;

  const body = rows.slice(hasHeader ? 1 : 0);
  const tooMany = Math.max(0, body.length - MAX_UPLOAD_ROWS);
  const entries = body.slice(0, MAX_UPLOAD_ROWS).map((row) => ({
    email: row[emailCol] || '',
    name:
      nameCol >= 0
        ? row[nameCol]
        : [firstCol >= 0 ? row[firstCol] : '', lastCol >= 0 ? row[lastCol] : ''].join(' '),
  }));
  return collect(entries, 0, tooMany);
};

// Addresses typed or pasted into a box: one or more per line, separated by
// commas, semicolons or spaces, with or without "Name <address>".
export const parsePastedContacts = (text: string): ParsedList => {
  const entries = text
    .split(/[\s,;]+/)
    .map((part) => part.replace(/^[<"'(]+|[>"'),.]+$/g, ''))
    // words without an @ are names or notes ("Ann <ann@example.com>"), not addresses
    .filter((part) => part.includes('@'))
    .map((email) => ({ email, name: null }));
  const tooMany = Math.max(0, entries.length - MAX_UPLOAD_ROWS);
  return collect(entries.slice(0, MAX_UPLOAD_ROWS), 0, tooMany);
};

// The unsubscribe link's token: the contact's id and a signature, so a link
// can't be made up or changed to unsubscribe someone else. It never expires:
// an old email's link must keep working.
const tokenSecret = (env: NodeJS.ProcessEnv = process.env) =>
  (env.OURS_EMAIL_TOKEN_SECRET || env.JWT_SECRET || '').trim();

const sign = (contactId: string, secret: string) =>
  createHmac('sha256', secret).update(`ours-email-unsubscribe:${contactId}`).digest('base64url');

export const unsubscribeToken = (contactId: string, env: NodeJS.ProcessEnv = process.env) => {
  const secret = tokenSecret(env);
  if (!secret) {
    throw new Error('OURS_EMAIL_TOKEN_SECRET (or JWT_SECRET) is not set');
  }
  return `${Buffer.from(contactId).toString('base64url')}.${sign(contactId, secret)}`;
};

// The contact id a token was made for, or null if it isn't one of ours.
export const readUnsubscribeToken = (
  token: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env
): string | null => {
  const secret = tokenSecret(env);
  if (!secret || !token || token.length > 200) {
    return null;
  }
  const [idPart, signature] = token.split('.');
  if (!idPart || !signature) {
    return null;
  }
  const contactId = Buffer.from(idPart, 'base64url').toString('utf8');
  const expected = Buffer.from(sign(contactId, secret));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? contactId : null;
};
