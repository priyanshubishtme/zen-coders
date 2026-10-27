import { z } from 'zod';
import { parseAuthKeys } from '../services/vault/authState.js';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MAX_HTML_BYTES: z.coerce.number().int().positive().default(512_000),
  SCAN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(300),
  SCAN_RATE_LIMIT_RPM: z.coerce.number().int().positive().default(30),
  BROWSER_MAX_CONTEXTS: z.coerce.number().int().positive().default(4),
  SCAN_QUEUE_MAX: z.coerce.number().int().nonnegative().default(20),
  NETWORK_IDLE_MAX_MS: z.coerce.number().int().positive().default(5_000),

  ALLOW_PRIVATE_URLS: bool,
  MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(15_000_000),
  MAX_SUBREQUESTS: z.coerce.number().int().positive().default(100),
  MAX_REDIRECTS: z.coerce.number().int().nonnegative().default(5),
  SUBREQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  STORE_MAX_SCANS: z.coerce.number().int().positive().default(200),

  INCLUDE_AAA: bool,

  LLM_PROVIDER: z.enum(['none', 'openai-compatible', 'mock']).default('none'),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL_CHEAP: z.string().default(''),
  LLM_MODEL_VISION: z.string().default(''),
  LLM_MODEL_STRONG: z.string().default(''),
  LLM_PRICE_INPUT_PER_M: z.coerce.number().nonnegative().default(0),
  LLM_PRICE_OUTPUT_PER_M: z.coerce.number().nonnegative().default(0),
  /** 0 means unlimited. The prototype default is unlimited. */
  LLM_TOKEN_BUDGET_PER_SCAN: z.coerce.number().int().nonnegative().default(0),
  LLM_TOKEN_BUDGET_PER_IP_DAY: z.coerce.number().int().nonnegative().default(100_000),
  /** 0 means no process-wide ceiling. Counts per UTC day. */
  LLM_TOKEN_DAILY_CEILING: z.coerce.number().int().nonnegative().default(0),
  LLM_RPM: z.coerce.number().int().positive().default(30),
  LLM_TPM: z.coerce.number().int().positive().default(60_000),
  /** auto = on in production (Render/Vercel). Needed so per-IP budgets see the real client. */
  TRUST_PROXY: bool,

  STORE: z.enum(['memory', 'mongo']).default('memory'),
  MONGODB_URI: z.string().default(''),
  /** Shared report links and stored scans expire after this many days. */
  SCAN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** Viewport screenshots. Default on. A failed shot never fails the scan. */
  SCREENSHOTS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SCREENSHOT_QUALITY: z.coerce.number().int().min(30).max(90).default(60),
  SCREENSHOT_MAX_BYTES: z.coerce.number().int().positive().default(500_000),
  VIEWPORT_WIDTH: z.coerce.number().int().min(320).max(1920).default(1280),
  VIEWPORT_HEIGHT: z.coerce.number().int().min(320).max(1440).default(720),

  /** false: daily scan, page, token, and logged-out caps are not enforced. Meters still count. */
  QUOTAS_ENABLED: bool,
  REDIS_URL: z.string().default(''),
  COOKIE_SAMESITE: z.enum(['lax', 'none']).default('lax'),
  /** `id:<base64 32 bytes>` comma-separated. Empty disables authenticated scans only. */
  AUTH_STATE_KEYS: z.string().default(''),
  PRO_EMAILS: z.string().default(''),

  CRAWL_MAX_PAGES: z.coerce.number().int().positive().default(10),
  CRAWL_MAX_DEPTH: z.coerce.number().int().nonnegative().default(2),
  CRAWL_BUDGET_MS: z.coerce.number().int().positive().default(180_000),
  CRAWL_GAP_MS: z.coerce.number().int().nonnegative().default(500),
  CRAWL_DELAY_CAP_MS: z.coerce.number().int().positive().default(5_000),
  PAGE_BUDGET_MS: z.coerce.number().int().positive().default(15_000),
  DOM_QUIET_MS: z.coerce.number().int().nonnegative().default(500),
  KEYBOARD_MAX_STOPS: z.coerce.number().int().positive().default(50),
  PAGE_HTML_MAX_BYTES: z.coerce.number().int().positive().default(2_000_000),
  CACHE_MAX_BYTES: z.coerce.number().int().positive().default(256 * 1024 * 1024),
  ZIP_MAX_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  AUTH_RETENTION_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),

  LOGGED_OUT_SCANS_DAY: z.coerce.number().int().nonnegative().default(100),
  LOGIN_IP_PER_HOUR: z.coerce.number().int().positive().default(100),
  SIGNUP_IP_PER_HOUR: z.coerce.number().int().positive().default(30),
  FREE_SCANS_DAY: z.coerce.number().int().positive().default(30),
  FREE_PAGES_DAY: z.coerce.number().int().positive().default(100),
  FREE_TOKENS_DAY: z.coerce.number().int().positive().default(50_000),
  FREE_CRAWL_PAGES: z.coerce.number().int().positive().default(5),
  PRO_SCANS_DAY: z.coerce.number().int().positive().default(300),
  PRO_PAGES_DAY: z.coerce.number().int().positive().default(1_000),
  PRO_TOKENS_DAY: z.coerce.number().int().positive().default(300_000),
  PRO_CRAWL_PAGES: z.coerce.number().int().positive().default(10),
  /** When quotas are on and this is > 0, it replaces the Free/anonymous daily token cap. */
  TOKEN_DAILY_OVERRIDE: z.coerce.number().int().nonnegative().default(0),
});

/** @typedef {z.infer<typeof EnvSchema>} Config */

/**
 * Parse and freeze configuration. Empty strings count as "unset" so a blank
 * line in .env falls back to the default instead of failing validation.
 * @param {Record<string, string | undefined>} source
 * @returns {Readonly<Config>}
 */
export function loadConfig(source = process.env) {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== ''),
  );
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  const data = parsed.data;
  if (!('TRUST_PROXY' in cleaned) && data.NODE_ENV === 'production') data.TRUST_PROXY = true;
  if (data.ALLOW_PRIVATE_URLS && data.NODE_ENV === 'production') {
    throw new Error('Invalid configuration: ALLOW_PRIVATE_URLS cannot be enabled in production.');
  }
  if (data.STORE === 'mongo' && !data.MONGODB_URI) {
    throw new Error('Invalid configuration: MONGODB_URI is required when STORE=mongo.');
  }
  if (data.REDIS_URL && data.STORE !== 'mongo') {
    throw new Error('Invalid configuration: REDIS_URL requires STORE=mongo.');
  }
  if (data.PRO_TOKENS_DAY <= data.FREE_TOKENS_DAY) {
    throw new Error('Invalid configuration: PRO_TOKENS_DAY must be greater than FREE_TOKENS_DAY.');
  }
  if (
    data.LLM_TOKEN_DAILY_CEILING > 0 &&
    data.LLM_TOKEN_BUDGET_PER_SCAN > 0 &&
    data.LLM_TOKEN_DAILY_CEILING < data.LLM_TOKEN_BUDGET_PER_SCAN
  ) {
    throw new Error('Invalid configuration: LLM_TOKEN_DAILY_CEILING is smaller than LLM_TOKEN_BUDGET_PER_SCAN.');
  }
  if (
    data.LLM_TOKEN_BUDGET_PER_SCAN > 0 &&
    data.FREE_TOKENS_DAY > 0 &&
    data.LLM_TOKEN_BUDGET_PER_SCAN > data.FREE_TOKENS_DAY
  ) {
    throw new Error('Invalid configuration: per-scan token budget exceeds the Free daily token budget.');
  }
  if (data.TOKEN_DAILY_OVERRIDE > 0 && data.PRO_TOKENS_DAY <= data.TOKEN_DAILY_OVERRIDE) {
    throw new Error('Invalid configuration: PRO_TOKENS_DAY must be greater than TOKEN_DAILY_OVERRIDE.');
  }
  data.authKeys = parseAuthKeys(data.AUTH_STATE_KEYS);
  return Object.freeze(data);
}
