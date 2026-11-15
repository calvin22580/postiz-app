// OURS: owners type in any URL, and our server fetches it. Only public http(s)
// addresses are allowed, so nobody can point the crawler at our own network.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error {}

export const crawlerAllowsPrivate = () =>
  process.env.OURS_CRAWLER_ALLOW_PRIVATE === 'true';

const v4ToInt = (ip: string) =>
  ip.split('.').reduce((n, part) => (n << 8) + Number(part), 0) >>> 0;

const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
];

export const isPrivateAddress = (ip: string): boolean => {
  if (isIP(ip) === 4) {
    const n = v4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (v4ToInt(base) & mask);
    });
  }
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    return isPrivateAddress(mapped[1]);
  }
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') ||
    lower.startsWith('ff')
  );
};

// Accepts "example.co.uk" as well as full URLs.
export const normaliseWebsiteUrl = (raw: string): URL => {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new UnsafeUrlError('Please enter your website address.');
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError('That does not look like a website address.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UnsafeUrlError('Only web addresses (http or https) can be read.');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Please enter the address without a login in it.');
  }
  if (!url.hostname.includes('.') && !crawlerAllowsPrivate()) {
    throw new UnsafeUrlError('That does not look like a website address.');
  }
  url.hash = '';
  return url;
};

export const assertPublicUrl = async (
  url: URL,
  allowPrivate = crawlerAllowsPrivate()
) => {
  if (allowPrivate) {
    return;
  }
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new UnsafeUrlError('That website uses a port we cannot read.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map(
        (a) => a.address
      );
  if (!addresses.length) {
    throw new UnsafeUrlError('We could not find that website. Is the address right?');
  }
  if (addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError('That address is not a public website.');
  }
};
