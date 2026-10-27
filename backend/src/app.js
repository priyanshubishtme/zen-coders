import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { nanoid } from 'nanoid';
import { createAuthController } from './controllers/auth.controller.js';
import { createHealthController } from './controllers/health.controller.js';
import { createScansController } from './controllers/scans.controller.js';
import { createUsageController } from './controllers/usage.controller.js';
import { attachActor } from './middleware/actor.js';
import { csrfGuard } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { requestTimeout } from './middleware/timeout.js';
import { createRepository } from './repositories/index.js';
import { createRouter } from './routes/index.js';
import { createAccountStore } from './services/accounts/store.js';
import { createLlmProvider } from './services/llm/index.js';
import { createOrchestrator } from './services/orchestrator/index.js';
import { createMeter } from './services/quota/meter.js';
import { createScanner } from './services/scanner/index.js';
import { createVault } from './services/vault/authState.js';
import { createLogger } from './utils/logger.js';

export const VERSION = '0.1.0';

/** JSON wrapper around the HTML payload needs a little headroom. */
const JSON_OVERHEAD_BYTES = 16_384;

/**
 * Build the Express app. Every dependency can be overridden for tests.
 * `lookup` replaces DNS resolution for both the API check and the browser guard.
 * @param {object} config result of loadConfig()
 * @param {Partial<{ scanner: object, repo: object, llm: object, logger: object, lookup: Function }>} [overrides]
 */
export function createApp(config, overrides = {}) {
  const logger = overrides.logger ?? createLogger(config);
  const scanner = overrides.scanner ?? createScanner(config, { logger, lookup: overrides.lookup });
  const repo = overrides.repo ?? createRepository(config, logger);
  const accounts = overrides.accounts ?? createAccountStore({ uri: config.STORE === 'mongo' ? config.MONGODB_URI : '' });
  const meter =
    overrides.meter ??
    createMeter({
      ceiling: config.LLM_TOKEN_DAILY_CEILING,
      persist: {
        get: (key) => accounts.getCounter(key),
        inc: (key, n) => accounts.addCounter(key, n),
      },
    });
  const vault =
    overrides.vault ??
    createVault({
      keys: config.authKeys ?? [],
      store: {
        set: (scanId, row) => accounts.putSecret(scanId, row.blob, row.expiresAt),
        get: async (scanId) => {
          const row = await accounts.getSecret(scanId);
          return row ? { blob: row.blob, expiresAt: row.expiresAt } : null;
        },
        delete: (scanId) => accounts.deleteSecret(scanId),
        sweep: (now) => accounts.sweepSecrets(now),
      },
    });
  const llm = overrides.llm ?? createLlmProvider(config, { logger, meter });
  const orchestrator = createOrchestrator({
    scanner,
    repo,
    config,
    logger,
    lookup: overrides.lookup,
    llm,
    accounts,
    vault,
    meter,
  });

  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
      exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After', 'Location'],
    }),
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: () => nanoid(10),
      // Polling GET /scans/:id twice a second would drown everything else.
      autoLogging: { ignore: (req) => req.method === 'GET' && req.url.startsWith('/scans/') },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: String(req.url ?? '').replace(/\/shares\/[^/?]+/g, '/shares/[redacted]'),
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(createRateLimiter(config.RATE_LIMIT_RPM));
  app.use(requestTimeout(config.REQUEST_TIMEOUT_MS));
  app.use(express.json({ limit: Math.max(config.MAX_HTML_BYTES, 200_000) + JSON_OVERHEAD_BYTES }));
  app.use(attachActor(accounts));
  app.use(csrfGuard(config));

  const controllers = {
    health: createHealthController({ scanner, repo, llm, config, version: VERSION, meter, vault }),
    scans: createScansController(orchestrator),
    usage: createUsageController(orchestrator),
    auth: createAuthController({ accounts, orchestrator, config }),
  };
  app.use(
    createRouter(controllers, { scanLimiter: createRateLimiter(config.SCAN_RATE_LIMIT_RPM) }),
  );

  app.use(notFound);
  app.use(errorHandler);

  app.locals.orchestrator = orchestrator;
  app.locals.scanner = scanner;
  app.locals.repo = repo;
  app.locals.accounts = accounts;
  app.locals.vault = vault;
  app.locals.meter = meter;
  return app;
}
