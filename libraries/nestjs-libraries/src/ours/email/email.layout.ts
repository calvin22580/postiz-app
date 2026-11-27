// OURS: the frame around every email we send, in the Story Mode design
// language (ours/design-language): cloud background, white card, a violet
// band with the butter sticker K, and the company details UK law asks for.
// Called from one marked line in services/email.service.ts. Set
// OURS_EMAIL_LAYOUT=upstream to get upstream's frame back.
//
// Email clients ignore most modern CSS, so this is tables and inline styles
// only: no web fonts (font stacks fall back to Arial), no SVG, no transforms.
import { brandName } from '@gitroom/nestjs-libraries/ours/brand/brand';

// The same details as the legal pages (apps/frontend/src/ours/legal/legal.defaults.json);
// email.layout.spec.ts checks they match.
export const COMPANY = {
  companyName: 'Steady Lamp Ltd',
  companyNumber: '17533499',
  registeredAddress: '128 City Road, London, EC1V 2NX',
  jurisdiction: 'England and Wales',
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const INK = '#121212';
const BUTTER = '#FFE15A';
const CLOUD = '#F4F2FF';
const LINE = '#E3DEF7';
const MUTED = '#5B5670';
const DISPLAY = `'Dela Gothic One', 'Arial Black', Arial, sans-serif`;
const UI = `'Instrument Sans', Arial, Helvetica, sans-serif`;

// same setting as the frontend's brand colour
export const brandColour = (env: NodeJS.ProcessEnv = process.env) =>
  HEX.test(env.NEXT_PUBLIC_BRAND_COLOUR || '') ? (env.NEXT_PUBLIC_BRAND_COLOUR as string) : '#6B3BFF';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const companyLine = (company = COMPANY) =>
  `${company.companyName}. Registered in ${company.jurisdiction}, company number ${company.companyNumber}. Registered office: ${company.registeredAddress}.`;

export const oursEmailLayout = (
  email: { subject: string; html: string; settingsUrl: string },
  env: NodeJS.ProcessEnv = process.env
): string | null => {
  if (env.OURS_EMAIL_LAYOUT === 'upstream') {
    return null;
  }
  const name = escapeHtml(brandName(env));
  const violet = brandColour(env);
  const subject = escapeHtml(email.subject);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${subject}</title>
<style>a{color:${violet}}</style>
</head>
<body style="margin:0;padding:0;background:${CLOUD};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CLOUD};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${LINE};border-radius:18px;border-collapse:separate;">
        <tr>
          <td style="background:${violet};border-radius:17px 17px 0 0;padding:18px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;background:${BUTTER};border:2px solid ${INK};border-radius:9px;font-family:${DISPLAY};font-size:19px;font-weight:900;line-height:34px;color:${INK};">K</td>
                <td style="padding-left:12px;font-family:${DISPLAY};font-size:20px;font-weight:900;color:#FFFFFF;">${name}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <h1 style="margin:0 0 18px;font-family:${DISPLAY};font-size:24px;font-weight:900;line-height:1.2;color:${INK};">${subject}</h1>
            <div style="font-family:${UI};font-size:15px;line-height:1.6;color:${INK};">
              ${email.html}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;">
            <div style="border-top:1px solid ${LINE};padding-top:16px;font-family:${UI};font-size:12px;line-height:1.6;color:${MUTED};">
              You can change your notification preferences in your <a href="${escapeHtml(email.settingsUrl)}" style="color:${violet};">account settings</a>.<br>
              ${name} is a service of ${escapeHtml(companyLine())}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
};
