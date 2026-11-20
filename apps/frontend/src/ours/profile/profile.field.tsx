'use client';
// OURS: one field of the business profile: its value(s), where each one came
// from on the owner's website, and an inline editor.
import { FC, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import type {
  ProfileField,
  ProfileFieldKey,
} from '@gitroom/nestjs-libraries/ours/profile/business.profile.fields';
import {
  BusinessProfile,
  readError,
} from '@gitroom/frontend/ours/profile/business.profile.hooks';

export const pageLabel = (
  url: string,
  pages: { url: string; title: string }[]
) => {
  try {
    const u = new URL(url);
    if (u.pathname === '/' || u.pathname === '') return 'Homepage';
    const title = pages.find((p) => p.url === url)?.title?.split(/\s[|–—-]\s/)[0];
    return title || u.pathname.replace(/^\/|\/$/g, '');
  } catch {
    return url;
  }
};

// no need to repeat the quote when it says exactly what the value says
const sameText = (a: string, b: string) =>
  a.replace(/\s+/g, ' ').trim().toLowerCase() ===
  b.replace(/\s+/g, ' ').trim().toLowerCase();

export const ProfileFieldCard: FC<{
  fieldKey: ProfileFieldKey;
  label: string;
  multiple: boolean;
  long?: boolean;
  field: ProfileField;
  pages: BusinessProfile['pages'];
  onSaved: (profile: BusinessProfile) => void;
}> = ({ fieldKey, label, multiple, long, field, pages, onSaved }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = field.claims.length === 0;

  const startEdit = () => {
    setDraft(field.claims.map((c) => c.value).join('\n'));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const values = multiple
      ? draft.split('\n').map((v) => v.trim()).filter(Boolean)
      : [draft.replace(/\s*\n\s*/g, ' ').trim()].filter(Boolean);
    const res = await fetch(`/ours/business-profile/fields/${fieldKey}`, {
      method: 'PUT',
      body: JSON.stringify({ values }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await readError(res)) || 'We could not save that. Please try again.');
      return;
    }
    const { profile } = await res.json();
    onSaved(profile);
    setEditing(false);
    toaster.show(`${label} saved`, 'success');
  };

  return (
    <div
      className="flex flex-col gap-[10px] py-[20px] border-t border-newBorder first:border-t-0"
      data-testid={`profile-field-${fieldKey}`}
    >
      <div className="flex items-center justify-between gap-[12px]">
        <div className="text-[13px] font-[600] uppercase tracking-[0.04em] text-textItemBlur">
          {label}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-[14px] text-textItemBlur underline-offset-[3px] hover:text-newTextColor hover:underline"
          >
            {empty ? 'Add' : 'Edit'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-[10px]">
          {multiple || long ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={multiple ? Math.max(3, draft.split('\n').length + 1) : 3}
              aria-label={label}
              className="w-full rounded-[8px] border border-newBorder bg-newBgColor px-[14px] py-[10px] text-[15px] leading-[1.5] outline-none focus:border-btnPrimary"
            />
          ) : (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              aria-label={label}
              className="w-full h-[44px] rounded-[8px] border border-newBorder bg-newBgColor px-[14px] text-[15px] outline-none focus:border-btnPrimary"
            />
          )}
          {multiple && (
            <div className="text-[13px] text-textItemBlur">One per line.</div>
          )}
          {error && <div className="text-[14px] text-red-500">{error}</div>}
          <div className="flex gap-[10px]">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className={clsx(
                'h-[38px] px-[18px] rounded-[8px] bg-btnPrimary text-white text-[14px] font-[500]',
                saving && 'opacity-60'
              )}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="h-[38px] px-[18px] rounded-[8px] text-[14px] text-textItemBlur hover:text-newTextColor"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : empty ? (
        <div className="text-[15px] text-textItemBlur" data-testid="not-found">
          {field.ownerEdited
            ? 'Left blank by you.'
            : 'Not found on your website.'}
        </div>
      ) : (
        <ul className="flex flex-col gap-[14px]">
          {field.claims.map((claim, i) => (
            <li key={i} className="flex flex-col gap-[6px]">
              <div className="text-[16px] leading-[1.5] whitespace-pre-wrap">
                {claim.value}
              </div>
              {claim.origin === 'owner' ? (
                <span
                  className="self-start rounded-full bg-newBgLineColor px-[10px] py-[2px] text-[12px] text-textItemBlur"
                  data-testid="owner-entered"
                >
                  Added by you
                </span>
              ) : (
                claim.sources.map((s, j) => (
                  <div
                    key={j}
                    className="flex flex-col gap-[2px] border-s-2 border-newBorder ps-[10px] text-[13px] text-textItemBlur"
                    data-testid="claim-source"
                  >
                    {!sameText(s.quote, claim.value) && (
                      <span className="italic">“{s.quote}”</span>
                    )}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="self-start underline decoration-newBorder underline-offset-[3px] hover:text-newTextColor"
                    >
                      Source: {pageLabel(s.url, pages)}
                    </a>
                  </div>
                ))
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
