import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { AppError } from './errors.js';

/** Special-purpose ranges from the IANA IPv4/IPv6 registries that must never be fetched. */
const IPV4_BLOCKED = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

/** Includes IPv4-mapped/compatible, 6to4 and Teredo, which can all embed a private IPv4. */
const IPV6_BLOCKED = [
  ['::', 96],
  ['::ffff:0:0', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

// Separate lists: a single BlockList also matches IPv4 addresses against
// IPv4-mapped IPv6 rules, so "::ffff:0:0/96" would block every IPv4 address.
const v4List = new BlockList();
const v6List = new BlockList();
for (const [net, prefix] of IPV4_BLOCKED) v4List.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of IPV6_BLOCKED) v6List.addSubnet(net, prefix, 'ipv6');

/** Expand an IPv6 string into eight 16-bit groups (handles "::" and a dotted IPv4 tail). */
function ipv6Groups(ip) {
  let s = ip;
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    s =
      s.slice(0, -dotted[1].length) +
      `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = s.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const fill = tail === undefined ? [] : Array(8 - h.length - t.length).fill('0');
  return [...h, ...fill, ...t].map((g) => parseInt(g, 16));
}

/** True for any address we refuse to connect to. Unknown formats are refused. */
export function isBlockedAddress(address) {
  const ip = String(address)
    .replace(/^\[|\]$/g, '')
    .split('%')[0];
  const family = isIP(ip);
  if (family === 4) return v4List.check(ip, 'ipv4');
  if (family !== 6) return true;
  const g = ipv6Groups(ip.toLowerCase());
  // NAT64 well-known prefix 64:ff9b::/96 embeds an IPv4 address in the last 32 bits.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    const v4 = [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.');
    return v4List.check(v4, 'ipv4');
  }
  return v6List.check(ip, 'ipv6');
}

/**
 * Validate a URL and resolve it to an address we are allowed to connect to.
 * The caller must connect to the returned address (not re-resolve), which
 * defeats DNS rebinding between check and use.
 *
 * @param {string} raw
 * @param {{ allowPrivate?: boolean, lookup?: typeof dnsLookup }} [opts]
 * @returns {Promise<{ url: URL, address: string, family: number }>}
 */
export async function resolveSafeUrl(raw, { allowPrivate = false, lookup = dnsLookup } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError('URL_BLOCKED', 'That is not a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('URL_BLOCKED', 'Only http and https URLs can be scanned.');
  }
  if (url.username || url.password) {
    throw new AppError('URL_BLOCKED', 'URLs with embedded credentials are not allowed.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses;
  if (isIP(host)) {
    addresses = [{ address: host, family: isIP(host) }];
  } else {
    try {
      addresses = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new AppError('FETCH_FAILED', `Could not resolve ${host}.`);
    }
  }
  if (!addresses?.length) throw new AppError('FETCH_FAILED', `Could not resolve ${host}.`);

  if (!allowPrivate) {
    const bad = addresses.find((a) => isBlockedAddress(a.address));
    if (bad) {
      throw new AppError(
        'URL_BLOCKED',
        `${host} points to a private or reserved network address, which cannot be scanned.`,
      );
    }
  }
  return { url, address: addresses[0].address, family: addresses[0].family };
}
