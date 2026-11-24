'use client';
// OURS: "What we've learned" (content engine E5). What brand memory has
// learned about how the owner likes their posts written, with the posts that
// taught each lesson. The owner can change, switch off, delete or add a
// lesson, and their changes are final: the Memory keeper can't undo them.
import { FC, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { readError } from '@gitroom/frontend/ours/profile/business.profile.hooks';
import {
  BrandMemoryOverview,
  LearnedLesson,
  LessonExample,
  useBrandMemory,
} from '@gitroom/frontend/ours/memory/memory.hooks';

const MAX_LESSON_LENGTH = 200;

// The folders in the owner's own terms, in the order of the brief.
const FOLDERS: { key: LearnedLesson['folder']; title: string }[] = [
  { key: 'voice', title: 'How your posts sound' },
  { key: 'phrases', title: 'Words you use' },
  { key: 'likes', title: 'Posts you like as they are' },
  { key: 'topics', title: 'What to post about' },
  { key: 'avoid', title: 'What you leave out' },
];

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
};

const REASONS: Record<string, string> = {
  tone: 'it didn’t sound like you',
  topic: 'wrong subject',
  untrue: 'not true',
  other: 'other',
};

const formatDate = (date: string) => newDayjs(date).format('DD/MM/YYYY');
const quote = (text: string | null) => {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return `“${t.length > 140 ? `${t.slice(0, 139).trimEnd()}…` : t}”`;
};

// One owner action, as a sentence.
const exampleText = (e: LessonExample) => {
  switch (e.kind) {
    case 'edited':
      return `You changed ${quote(e.before)} to ${quote(e.after)}`;
    case 'approved':
      return `You approved ${quote(e.after)}`;
    case 'rejected':
      return `You turned down ${quote(e.before)}`;
    case 'reject-reason':
      return `You turned a post down because ${REASONS[e.reason || ''] || 'of something else'}`;
    case 'rewrite':
      return e.note ? `You asked for a new version: ${quote(e.note)}` : `You asked for a new version of ${quote(e.before)}`;
    case 'restored':
      return `You brought back ${quote(e.after)}`;
    default:
      return '';
  }
};

const Shell: FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex-1 bg-newBgColorInner overflow-auto p-[40px] mobile:p-[16px]">
    <div className="max-w-[820px] mx-auto flex flex-col gap-[28px]">{children}</div>
  </div>
);

const Card: FC<{ children: React.ReactNode; testId?: string }> = ({ children, testId }) => (
  <section
    data-testid={testId}
    className="flex flex-col gap-[16px] rounded-[14px] border border-newBorder bg-newBgColor p-[20px] mobile:p-[16px]"
  >
    {children}
  </section>
);

const Notice: FC<{ children: React.ReactNode; tone?: 'plain' | 'attention'; testId?: string }> = ({
  children,
  tone = 'plain',
  testId,
}) => (
  <div
    data-testid={testId}
    className={clsx(
      'rounded-[10px] border px-[16px] py-[12px] text-[14px] leading-[1.6]',
      tone === 'attention' ? 'border-amber-500/40 bg-amber-500/10' : 'border-newBorder bg-newBgColor'
    )}
  >
    {children}
  </div>
);

const primary = 'h-[38px] px-[18px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[500]';
const quiet = 'text-[14px] text-textItemBlur underline-offset-[3px] hover:text-newTextColor hover:underline';

// Sends a change and reloads the screen. Returns the error to show, if any.
const useLessonAction = () => {
  const fetch = useFetch();
  const { mutate } = useBrandMemory();
  return async (path: string, method: 'POST' | 'PUT' | 'DELETE', body?: object) => {
    const res = await fetch(`/ours/brand-memory${path}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return (await readError(res)) || 'We couldn’t save that. Please try again.';
    await mutate();
    return null;
  };
};

const LessonEditor: FC<{
  initial: string;
  label: string;
  saveLabel: string;
  onSave: (text: string) => Promise<string | null>;
  onCancel?: () => void;
  testId: string;
}> = ({ initial, label, saveLabel, onSave, onCancel, testId }) => {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);
    const problem = await onSave(draft.trim());
    setSaving(false);
    if (problem) setError(problem);
    else if (!onCancel) setDraft('');
  };
  return (
    <div className="flex flex-col gap-[10px]" data-testid={testId}>
      <textarea
        autoFocus={!!onCancel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
        rows={2}
        maxLength={MAX_LESSON_LENGTH}
        aria-label={label}
        placeholder={onCancel ? undefined : 'For example: Don’t use exclamation marks'}
        className="w-full rounded-[8px] border border-newBorder bg-newBgColor px-[14px] py-[10px] text-[15px] leading-[1.5] outline-none focus:border-btnPrimary"
      />
      {error && (
        <div className="text-[14px] text-red-500" role="alert">
          {error}
        </div>
      )}
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.trim()}
          className={clsx(primary, (saving || !draft.trim()) && 'opacity-60')}
        >
          {saving ? 'Saving…' : saveLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-[38px] px-[12px] text-[14px] text-textItemBlur hover:text-newTextColor">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

const Examples: FC<{ lesson: LearnedLesson }> = ({ lesson }) => {
  const [open, setOpen] = useState(false);
  if (!lesson.examples.length) return null;
  return (
    <div className="flex flex-col gap-[8px]">
      <button type="button" onClick={() => setOpen(!open)} className={clsx(quiet, 'w-fit')} aria-expanded={open}>
        {open ? 'Hide why' : 'Why we think this'}
      </button>
      {open && (
        <ul className="flex flex-col gap-[8px] border-l-2 border-newBorder pl-[14px]" data-testid="memory-examples">
          {lesson.examples.map((e, i) => (
            <li key={i} className="flex flex-col gap-[2px]">
              <span className="text-[14px] leading-[1.5]">{exampleText(e)}</span>
              <span className="text-[13px] text-textItemBlur">
                {[e.platform && (PLATFORM_LABELS[e.platform] || e.platform), formatDate(e.createdAt)].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LessonRow: FC<{ lesson: LearnedLesson }> = ({ lesson }) => {
  const act = useLessonAction();
  const toaster = useToaster();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (path: string, method: 'PUT' | 'DELETE', done: string) => {
    setBusy(true);
    const problem = await act(path, method);
    setBusy(false);
    toaster.show(problem || done, problem ? 'warning' : 'success');
  };

  const remove = async () => {
    if (
      await deleteDialog(
        'We’ll forget this lesson and won’t learn it again. You can always write it back yourself.',
        'Delete it',
        'Delete this lesson?',
        'Keep it',
        true
      )
    ) {
      await run(`/lessons/${lesson.id}`, 'DELETE', 'Lesson deleted');
    }
  };

  return (
    <li className="flex flex-col gap-[10px] py-[16px] first:pt-0 last:pb-0" data-testid="memory-lesson" data-status={lesson.status}>
      {editing ? (
        <LessonEditor
          initial={lesson.lesson}
          label="Change this lesson"
          saveLabel="Save"
          testId="memory-edit"
          onCancel={() => setEditing(false)}
          onSave={async (text) => {
            const problem = await act(`/lessons/${lesson.id}`, 'PUT', { lesson: text });
            if (!problem) {
              setEditing(false);
              toaster.show('Lesson saved', 'success');
            }
            return problem;
          }}
        />
      ) : (
        <>
          <div className="flex flex-col gap-[6px]">
            <span className="text-[16px] leading-[1.5]" data-testid="memory-lesson-text">
              {lesson.lesson}
            </span>
            <span className="flex flex-wrap gap-[8px] text-[13px] text-textItemBlur">
              {lesson.source === 'owner' ? (
                <span>Set by you</span>
              ) : lesson.status === 'active' ? (
                <span>In use in your posts</span>
              ) : (
                <span>Seen once so far: we’ll start using it if you do it again</span>
              )}
            </span>
          </div>
          {lesson.source === 'keeper' && <Examples lesson={lesson} />}
          <div className={clsx('flex flex-wrap gap-x-[18px] gap-y-[6px]', busy && 'opacity-60 pointer-events-none')}>
            <button type="button" className={quiet} onClick={() => setEditing(true)}>
              Change
            </button>
            <button type="button" className={quiet} onClick={() => run(`/lessons/${lesson.id}/off`, 'PUT', 'Lesson switched off')}>
              Switch off
            </button>
            <button type="button" className={quiet} onClick={remove}>
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
};

const SwitchedOff: FC<{ lessons: LearnedLesson[] }> = ({ lessons }) => {
  const act = useLessonAction();
  const toaster = useToaster();
  if (!lessons.length) return null;
  return (
    <Card testId="memory-switched-off">
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[17px] font-[600]">Switched off</h2>
        <p className="text-[14px] leading-[1.6] text-textItemBlur">
          We don’t use these in your posts and won’t learn them again unless you switch them back on.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-newBorder">
        {lessons.map((l) => (
          <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-[16px] gap-y-[4px] py-[12px] first:pt-0 last:pb-0">
            <span className="text-[15px] text-textItemBlur line-through decoration-newBorder">{l.lesson}</span>
            <button
              type="button"
              className={quiet}
              onClick={async () => {
                const problem = await act(`/lessons/${l.id}/on`, 'PUT');
                toaster.show(problem || 'Lesson switched back on', problem ? 'warning' : 'success');
              }}
            >
              Switch back on
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const Lessons: FC<{ data: BrandMemoryOverview }> = ({ data }) => {
  const groups = FOLDERS.map((f) => ({ ...f, lessons: data.lessons.filter((l) => l.folder === f.key) })).filter(
    (g) => g.lessons.length
  );
  if (!groups.length) {
    return (
      <Card testId="memory-empty">
        <h2 className="text-[17px] font-[600]">Nothing learned yet</h2>
        <p className="text-[15px] leading-[1.6]">
          As you approve, change and turn down your weekly posts, we notice what you like and note it here. When you
          do the same thing twice, it becomes a lesson we use in your next posts.
        </p>
        <Link href="/captions" className="text-[15px] underline w-fit">
          Go to your weekly posts
        </Link>
      </Card>
    );
  }
  return (
    <>
      {groups.map((g) => (
        <Card key={g.key} testId={`memory-folder-${g.key}`}>
          <h2 className="text-[17px] font-[600]">{g.title}</h2>
          <ul className="flex flex-col divide-y divide-newBorder">
            {g.lessons.map((l) => (
              <LessonRow key={l.id} lesson={l} />
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
};

const AddLesson: FC = () => {
  const act = useLessonAction();
  const toaster = useToaster();
  return (
    <Card testId="memory-add">
      <div className="flex flex-col gap-[4px]">
        <h2 className="text-[17px] font-[600]">Tell us yourself</h2>
        <p className="text-[14px] leading-[1.6] text-textItemBlur">
          Something about how you like your posts written. Facts about your business, like prices or opening hours,
          go in your{' '}
          <Link href="/business-profile" className="underline">
            business profile
          </Link>{' '}
          instead.
        </p>
      </div>
      <LessonEditor
        initial=""
        label="A lesson in your own words"
        saveLabel="Add"
        testId="memory-add-form"
        onSave={async (text) => {
          const problem = await act('/lessons', 'POST', { lesson: text });
          if (!problem) toaster.show('Lesson added', 'success');
          return problem;
        }}
      />
    </Card>
  );
};

export const MemoryPage: FC = () => {
  const { data, error, mutate } = useBrandMemory();

  return (
    <Shell>
      <div className="flex flex-col gap-[6px]">
        <h1 className="text-[26px] font-[600]" data-testid="memory-heading">
          What we’ve learned
        </h1>
        <p className="text-[15px] leading-[1.6] text-textItemBlur">
          How you like your posts written, learned from the posts you approve, change and turn down. These only shape
          wording and which ideas we pick: what your posts say about your business always comes from your profile.
        </p>
      </div>
      {error ? (
        <Notice testId="memory-error">
          We couldn’t load what we’ve learned.{' '}
          <button type="button" className="underline" onClick={() => mutate()}>
            Try again
          </button>
        </Notice>
      ) : !data ? (
        <div className="flex flex-col gap-[16px]" aria-busy="true">
          <div className="h-[140px] rounded-[14px] bg-newBgLineColor animate-pulse" />
          <div className="h-[200px] rounded-[14px] bg-newBgLineColor animate-pulse" />
        </div>
      ) : (
        <>
          {!data.on && (
            <Notice tone="attention" testId="memory-off">
              Learning is switched off for now, so these lessons aren’t used in your posts yet.
            </Notice>
          )}
          {data.lastRun?.status === 'failed' && (
            <Notice testId="memory-last-run-failed">
              We couldn’t learn from your latest changes on {formatDate(data.lastRun.createdAt)}. We’ll try again before
              your next week of posts is written.
            </Notice>
          )}
          <Lessons data={data} />
          <AddLesson />
          <SwitchedOff lessons={data.switchedOff} />
        </>
      )}
    </Shell>
  );
};
