/** @param {string} raw @param {string} [base] */
export function normalizeCrawlUrl(raw, base) {
  let url;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}

/** @param {string} url */
export function hostOf(url) {
  return new URL(url).host;
}
