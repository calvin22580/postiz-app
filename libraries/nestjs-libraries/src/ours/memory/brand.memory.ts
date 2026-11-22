// OURS: content engine E4. Brand memory: short lessons about how an owner
// likes posts written and chosen, each citing the owner signals behind it.
// Lessons hold style and preferences only, never facts about the business:
// facts still come only from the sourced profile (ours/docs/content-engine.md).
// The Memory keeper sees lessons as files in a /memories folder (Anthropic's
// memory tool); these are the rules every lesson must pass before we store it.
import { unsupportedDetails } from '@gitroom/nestjs-libraries/ours/captions/caption.grounding';

export const MEMORY_ROOT = '/memories';

// The folders the keeper may write in, and what each one is for. The order is
// the order of the brand brief.
export const MEMORY_FOLDERS = [
  { key: 'voice', label: 'How posts should sound' },
  { key: 'phrases', label: 'Words the owner uses or swaps out' },
  { key: 'likes', label: 'Kinds of post the owner approves as written' },
  { key: 'topics', label: 'Subjects to favour or leave out' },
  { key: 'avoid', label: 'Things the owner removes or rejects' },
] as const;

export type MemoryFolder = (typeof MEMORY_FOLDERS)[number]['key'];

export const MAX_LESSONS = 30;
export const MAX_LESSON_LENGTH = 200;
// how many owner actions one lesson may cite
export const MAX_EVIDENCE = 20;
// a signal is cited by the first characters of its id
export const SIGNAL_REF_LENGTH = 8;

export type LessonStatus = 'tentative' | 'active' | 'retired';
export type LessonSource = 'keeper' | 'owner';

export interface Lesson {
  path: string;
  lesson: string;
  evidence: string[];
  against: string[];
  source: LessonSource;
}

// Our code decides a lesson's status from its evidence, not the keeper: one
// owner action is a hunch, two agreeing ones make a lesson.
export const lessonStatus = (l: Pick<Lesson, 'evidence' | 'against'>): LessonStatus => {
  const score = new Set(l.evidence).size - new Set(l.against).size;
  return score >= 2 ? 'active' : score === 1 ? 'tentative' : 'retired';
};

const FOLDER_KEYS = MEMORY_FOLDERS.map((f) => f.key) as readonly string[];
const FILE = /^[a-z0-9][a-z0-9-]{0,58}\.md$/;

// What a path names: the root, one of our folders, or a lesson file in one.
// Anything else (another folder, "..", encoded characters, a trailing slash)
// is null.
export const parseMemoryPath = (
  path: string
): { kind: 'root' } | { kind: 'folder'; folder: MemoryFolder } | { kind: 'file'; folder: MemoryFolder } | null => {
  if (typeof path !== 'string') return null;
  if (path === MEMORY_ROOT) return { kind: 'root' };
  const parts = path.split('/');
  // ['', 'memories', folder, file?]
  if (parts.length < 3 || parts.length > 4 || parts[0] !== '' || parts[1] !== 'memories') return null;
  if (!FOLDER_KEYS.includes(parts[2])) return null;
  const folder = parts[2] as MemoryFolder;
  if (parts.length === 3) return { kind: 'folder', folder };
  return FILE.test(parts[3]) ? { kind: 'file', folder } : null;
};

// The file the keeper reads and writes. The status line is ours: shown so the
// keeper knows which lessons are in use, ignored when it writes the file back.
export const formatLessonFile = (l: Lesson) =>
  [
    `lesson: ${l.lesson}`,
    `evidence: ${l.evidence.join(', ')}`,
    `against: ${l.against.join(', ')}`,
    `status: ${lessonStatus(l)}${l.source === 'owner' ? ', written by the owner' : ''} (set by Kanosena; you can't change this line)`,
  ].join('\n');

// words a model writes for "no ids" instead of leaving the line empty
const NO_REFS = new Set(['nothing', 'none', 'n/a', 'na', '-', 'empty', 'null', '(none)', '(empty)']);

const refs = (value: string) =>
  [...new Set(value.split(/[\s,]+/).map((r) => r.trim().toLowerCase()).filter((r) => r && !NO_REFS.has(r)))];

export class LessonFileError extends Error {}

export const parseLessonFile = (text: string): Pick<Lesson, 'lesson' | 'evidence' | 'against'> => {
  const fields: Record<string, string> = {};
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(lesson|evidence|against|status)\s*:\s*(.*)$/i);
    if (!m) {
      throw new LessonFileError(
        'A lesson file has only three lines: "lesson: <one sentence>", "evidence: <signal ids>" and "against: <signal ids, or empty>".'
      );
    }
    const key = m[1].toLowerCase();
    if (key in fields) throw new LessonFileError(`The "${key}" line appears twice.`);
    fields[key] = m[2].trim();
  }
  if (!fields.lesson) throw new LessonFileError('The file needs a "lesson:" line with one sentence.');
  return {
    lesson: fields.lesson,
    evidence: refs(fields.evidence || ''),
    against: refs(fields.against || ''),
  };
};

// Words that state something about the business rather than how to write
// about it. The caption hard rules catch numbers, prices, links, handles and
// claim words; these catch the rest of the usual ways a fact slips in.
const FACT_PATTERNS: [RegExp, string][] = [
  [/\b(?:we|they|the business|the shop|the company)\s+(?:are|is|was|were|has|have|had|sell|sells|serve|serves|offer|offers|make|makes|do|does|run|runs|own|owns|open|opens|close|closes|stock|stocks|provide|provides|deliver|delivers|cover|covers)\b/i, 'says what the business is or does'],
  [/\b(?:open|opens|opening|closed|closes|closing)\s+(?:on|at|from|until|till|every|daily|late|early|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekends?)\b/i, 'opening times'],
  [/\b(?:since|founded|established|est\.|years? in|years? of|family[- ]run|family[- ]owned|started (?:the|it|in))\b/i, 'history of the business'],
  [/\b(?:located|based in|based at|situated|address|postcode|parking)\b/i, 'where the business is'],
  [/\b(?:price list|prices? (?:are|is|start|from)|costs? (?:just|only|from)|charges? (?:for|from))\b/i, 'prices'],
];

// Numbers are fine when they describe the writing itself ("at most 2 emoji").
// "works best when", "best kept short": about the writing, not a claim
const STYLE_BEST = /\b(?:works?|worked|working|land|lands|reads?|go(?:es)?) best\b|\bbest (?:when|if|with|kept|left)\b/gi;

const STYLE_NUMBER = /\b\d+\s*(?:sentences?|words?|characters?|emoji|emojis|hashtags?|lines?|paragraphs?|exclamation marks?|questions?)\b/gi;

// Folders whose lessons name things to stay away from: a claim word there is
// a preference ("don't push offers"), not a claim.
const CLAIM_WORDS_ALLOWED: readonly string[] = ['avoid', 'topics'];

// Why a lesson can't be stored, or an empty list when it can.
export const lessonProblems = (lesson: string, folder: MemoryFolder) => {
  const problems: string[] = [];
  if (lesson.length > MAX_LESSON_LENGTH) {
    problems.push(`it is longer than ${MAX_LESSON_LENGTH} characters`);
  }
  const details = unsupportedDetails(lesson.replace(STYLE_NUMBER, ' ').replace(STYLE_BEST, ' '), []).filter(
    (d) => !(CLAIM_WORDS_ALLOWED.includes(folder) && /^[a-z][a-z .-]*$/.test(d))
  );
  if (details.length) {
    problems.push(`it names business details (${details.join(', ')})`);
  }
  for (const [re, what] of FACT_PATTERNS) {
    if (re.test(lesson)) problems.push(`it states a fact about the business (${what})`);
  }
  return problems;
};

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

// Nearly the same lesson: most of the words in common.
export const similarLessons = (a: string, b: string) => {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return false;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.min(wa.size, wb.size) >= 0.7;
};

// The brand brief: the lessons in use, grouped by folder, for the writer, the
// rewriter and the Checker. Empty when there is nothing to say.
export const brandBrief = (lessons: Pick<Lesson, 'path' | 'lesson' | 'evidence' | 'against' | 'source'>[], only?: MemoryFolder[]) => {
  const active = lessons.filter((l) => lessonStatus(l) === 'active' || l.source === 'owner');
  const sections = MEMORY_FOLDERS.filter((f) => !only || only.includes(f.key))
    .map((f) => ({
      label: f.label,
      lines: active.filter((l) => parseMemoryPath(l.path)?.kind === 'file' && l.path.split('/')[2] === f.key).map((l) => `- ${l.lesson}`),
    }))
    .filter((s) => s.lines.length);
  return sections.map((s) => `${s.label}:\n${s.lines.join('\n')}`).join('\n\n');
};
