import { describe, expect, it } from 'vitest';
import { emailPlainText } from '@gitroom/nestjs-libraries/ours/email/plain.text';

// upstream's frame from services/email.service.ts, shortened
const upstreamFrame = (subject: string, html: string) => `
    <div style="background: linear-gradient(to bottom right, #e6f2ff, #f0e6ff); padding: 2rem;">
        <div style="padding: 2rem;">
            <h1 style="font-size: 1.875rem;">${subject}</h1>
            <div style="margin-bottom: 2rem;">
                ${html}
            </div>
            <div style="border-top: 1px solid #e5e7eb;">
                <div>
                    <h2 style="margin: 0;">Kanosena</h2>
                    <div style="font-size: 12px">
                      You can change your notification preferences in your <a href="https://app.kanosena.com/settings">account settings.</a>
                     </div>
                </div>
            </div>
        </div>
    </div>
    `;

const resetBody =
  'You have requested to reset your password. <br />Click <a href="https://app.kanosena.com/auth/forgot/abc.def">here</a> to reset your password<br />The link will expire in 20 minutes';

describe('emailPlainText', () => {
  it('turns the password reset email into readable text with the link written out', () => {
    expect(emailPlainText(upstreamFrame('Reset your password', resetBody))).toBe(
      [
        'Reset your password',
        '',
        'You have requested to reset your password.',
        'Click here (https://app.kanosena.com/auth/forgot/abc.def) to reset your password',
        'The link will expire in 20 minutes',
        '',
        'Kanosena',
        '',
        'You can change your notification preferences in your account settings. (https://app.kanosena.com/settings)',
      ].join('\n')
    );
  });

  it('leaves no tags, styles or entities behind', () => {
    const text = emailPlainText(upstreamFrame('Tom &amp; Jerry&#39;s', '<p>Caf&eacute; &lt;open&gt;&nbsp;now</p>'));
    expect(text).not.toMatch(/<\/?(div|p|h1|h2|a)\b|style=|&\w+;/);
    expect(text).toContain("Tom & Jerry's");
    expect(text).toContain('Café <open> now');
    expect(text).not.toContain('gradient');
  });

  it('skips the head, title and style of a full HTML document', () => {
    const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Activate your account</title>
      <style>a{color:#6B3BFF}</style></head><body><table><tr><td><h1>Activate your account</h1>
      <div>Click <a href="https://app.kanosena.com/auth/activate/xyz">here</a> to activate your account</div></td></tr></table></body></html>`;
    expect(emailPlainText(doc)).toBe(
      'Activate your account\n\nClick here (https://app.kanosena.com/auth/activate/xyz) to activate your account'
    );
  });

  it('writes a link once when its words are the address', () => {
    expect(emailPlainText('<a href="mailto:support@kanosena.com">support@kanosena.com</a>')).toBe('support@kanosena.com');
    expect(emailPlainText('<a href="https://kanosena.com">https://kanosena.com</a>')).toBe('https://kanosena.com');
  });

  it('lists list items on their own lines', () => {
    expect(emailPlainText('<p>Next:</p><ul><li>One</li><li>Two</li></ul>')).toBe('Next:\n\n- One\n- Two');
  });

  it('handles an empty body', () => {
    expect(emailPlainText('')).toBe('');
  });
});
