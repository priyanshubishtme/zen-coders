import { describe, expect, it } from 'vitest';
import { isBlockedAddress, resolveSafeUrl } from '../src/utils/urlSafety.js';

const fakeLookup = (map) => async (host) => {
  if (!(host in map)) throw new Error('ENOTFOUND');
  return map[host].map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
};

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '::1',
    '::',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
    'fe80::1',
    'fe80::1%eth0',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '64:ff9b::a9fe:a9fe',
    '2002:7f00:1::',
    '[::1]',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each(['93.184.215.14', '8.8.8.8', '172.32.0.1', '2606:4700::6810:84e5', '64:ff9b::808:808'])(
    'allows public %s',
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false);
    },
  );
});

describe('resolveSafeUrl', () => {
  const lookup = fakeLookup({
    'example.com': ['93.184.215.14'],
    'metadata.evil.test': ['169.254.169.254'],
    'mixed.evil.test': ['93.184.215.14', '10.0.0.1'],
    localhost: ['127.0.0.1'],
  });

  it('accepts a public https URL and returns the pinned address', async () => {
    const r = await resolveSafeUrl('https://example.com/a?b=1', { lookup });
    expect(r.address).toBe('93.184.215.14');
    expect(r.url.href).toBe('https://example.com/a?b=1');
  });

  it.each([
    ['file:///etc/passwd', /Only http and https/],
    ['javascript:alert(1)', /Only http and https/],
    ['ftp://example.com/x', /Only http and https/],
    ['data:text/html,<p>x</p>', /Only http and https/],
    ['https://user:pass@example.com/', /credentials/],
    ['not a url', /not a valid URL/],
    ['http://127.0.0.1:4000/health', /private or reserved/],
    ['http://2130706433/', /private or reserved/],
    ['http://0x7f.1/', /private or reserved/],
    ['http://[::1]/', /private or reserved/],
    ['http://localhost/', /private or reserved/],
    ['http://metadata.evil.test/latest/meta-data', /private or reserved/],
    ['http://mixed.evil.test/', /private or reserved/],
  ])('rejects %s', async (url, message) => {
    await expect(resolveSafeUrl(url, { lookup })).rejects.toMatchObject({
      code: 'URL_BLOCKED',
      message: expect.stringMatching(message),
    });
  });

  it('reports DNS failure as FETCH_FAILED', async () => {
    await expect(resolveSafeUrl('https://nope.invalid/', { lookup })).rejects.toMatchObject({
      code: 'FETCH_FAILED',
    });
  });

  it('allows private addresses only when explicitly enabled', async () => {
    const r = await resolveSafeUrl('http://localhost/', { lookup, allowPrivate: true });
    expect(r.address).toBe('127.0.0.1');
  });
});
