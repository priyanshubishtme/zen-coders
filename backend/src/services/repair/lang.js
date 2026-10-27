/** Tiny deterministic language guesser for html-has-lang. No network, no model. */

const STOPWORDS = {
  en: 'the and of to a in is for on with that this your our are you it be at by from or as we will more over about all new not but can has have every before after',
  es: 'el la de que y en los las por con para una es del su al lo como más pero sus',
  fr: 'le la les de des et en un une pour est que dans du sur au avec ce pas qui nous vous',
  de: 'der die das und ist mit für den von zu ein eine auf nicht sie ich es im dem auch',
  pt: 'o a os as de que e do da em um uma para com não no na por mais se',
  it: 'il la di che e per un una del della con non sono gli le nel è da al',
  nl: 'de het een en van is op met voor niet zijn dat die te ook bij aan je',
};

const SCRIPTS = [
  ['hi', /[\u0900-\u097F]/g],
  ['ru', /[\u0400-\u04FF]/g],
  ['ar', /[\u0600-\u06FF]/g],
  ['ja', /[\u3040-\u30FF]/g],
  ['ko', /[\uAC00-\uD7AF]/g],
  ['zh', /[\u4E00-\u9FFF]/g],
];

/** @returns {{ lang: string, confident: boolean }} */
export function detectLanguage(text) {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '').length || 1;
  for (const [lang, re] of SCRIPTS) {
    const n = text.match(re)?.length ?? 0;
    if (n / letters > 0.3) return { lang, confident: n > 20 };
  }
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const scores = Object.entries(STOPWORDS)
    .map(([lang, list]) => {
      const set = new Set(list.split(' '));
      return [lang, words.filter((w) => set.has(w)).length];
    })
    .sort((a, b) => b[1] - a[1]);
  const [[best, top], [, second]] = scores;
  if (top === 0) return { lang: 'en', confident: false };
  return { lang: best, confident: words.length >= 20 && top >= 3 && top >= second * 2 };
}

const LANG_FIXES = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  hindi: 'hi',
  portuguese: 'pt',
  italian: 'it',
  dutch: 'nl',
  chinese: 'zh',
  japanese: 'ja',
};

/** Map common invalid lang values to BCP 47 ("english" -> "en", "en_US" -> "en-US"). */
export function fixLangCode(value) {
  const v = String(value ?? '').trim();
  if (LANG_FIXES[v.toLowerCase()]) return LANG_FIXES[v.toLowerCase()];
  const m = /^([a-z]{2,3})[_-]([a-z]{2})$/i.exec(v);
  if (m) return `${m[1].toLowerCase()}-${m[2].toUpperCase()}`;
  if (/^[a-z]{2,3}$/i.test(v)) return v.toLowerCase();
  return null;
}
