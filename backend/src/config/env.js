import { z } from 'zod';

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
  SCAN_RATE_LIMIT_RPM: z.coerce.number().int().positive().default(10),
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
  LLM_TOKEN_BUDGET_PER_SCAN: z.coerce.number().int().nonnegative().default(8000),
  LLM_TOKEN_BUDGET_PER_IP_DAY: z.coerce.number().int().nonnegative().default(100_000),
  LLM_RPM: z.coerce.number().int().positive().default(30),
  LLM_TPM: z.coerce.number().int().positive().default(60_000),
  /** auto = on in production (Render/Vercel). Needed so per-IP budgets see the real client. */
  TRUST_PROXY: bool,

  STORE: z.enum(['memory', 'mongo']).default('memory'),
  MONGODB_URI: z.string().default(''),
  /** Shared report links and stored scans expire after this many days. */
  SCAN_TTL_DAYS: z.coerce.number().int().positive().default(30),
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
  return Object.freeze(data);
}
