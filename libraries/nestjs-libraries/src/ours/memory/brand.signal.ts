// OURS: content engine E1. The owner actions we keep as signals, so later
// milestones can learn each brand's style from them. A signal is a record of
// what the owner did, never a fact about the business: facts still come only
// from the sourced business profile (ours/docs/content-engine.md).

export const SIGNAL_KINDS = [
  // approved and scheduled, with or without the owner's own changes
  'approved',
  // the owner rewrote the text themselves (before = previous text)
  'edited',
  'rejected',
  // the owner said why they rejected a post (optional, after rejecting)
  'reject-reason',
  // a rejected post was brought back
  'restored',
  // an AI rewrite the owner asked for (note = what they asked to change)
  'rewrite',
  // after AI rewrites, the owner went back to the earlier version (before =
  // the rewrite they turned down, after = the version they kept)
  'kept-previous',
] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];

// The one-tap reasons offered after rejecting a post. Labels finish the
// question "Why didn't this one work?".
export const REJECT_REASONS = [
  { key: 'topic', label: 'Wrong topic' },
  { key: 'tone', label: 'Doesn’t sound like us' },
  { key: 'untrue', label: 'Not true' },
  { key: 'salesy', label: 'Too salesy' },
  { key: 'other', label: 'Something else' },
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number]['key'];

export const REJECT_REASON_KEYS = REJECT_REASONS.map((r) => r.key) as RejectReason[];

export interface BrandSignal {
  kind: SignalKind;
  draftId?: string;
  weekId?: string;
  platform?: string;
  theme?: string;
  before?: string | null;
  after?: string | null;
  reason?: RejectReason;
  note?: string | null;
  edited?: boolean;
}
