export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

/** HttpOnly session cookie. Lax by default; SameSite=None; Secure only when COOKIE_SAMESITE=none. */
export function sessionCookie(config, token, { clear = false } = {}) {
  const sameSite = config.COOKIE_SAMESITE === 'none' ? 'None' : 'Lax';
  const secure = sameSite === 'None' || config.NODE_ENV === 'production';
  const parts = [
    `accessfix.sid=${clear ? '' : encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `SameSite=${sameSite}`,
    clear ? 'Max-Age=0' : `Max-Age=${14 * 24 * 60 * 60}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
