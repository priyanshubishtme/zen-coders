import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { nanoid } from 'nanoid';
import { createHealthController } from './controllers/health.controller.js';
import { createScansController } from './controllers/scans.controller.js';
import { createUsageController } from './controllers/usage.controller.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { requestTimeout } from './middleware/timeout.js';
import { createRepository } from './repositories/index.js';
import { createRouter } from './routes/index.js';
import { createLlmProvider } from './services/llm/index.js';
import { createOrchestrator } from './services/orchestrator/index.js';
import { createRepairEngine } from './services/repair/index.js';
import { createScanner } from './services/scanner/index.js';
import { createVerifier } from './services/verifier/index.js';
import { createLogger } from './utils/logger.js';

export const VERSION = '0.0.0';

/** JSON wrapper around the HTML payload needs a little headroom. */
const JSON_OVERHEAD_BYTES = 16_384;

/**
 * Build the Express app. Every dependency can be overridden for tests.
 * @param {object} config result of loadConfig()
 * @param {Partial<{ scanner: object, repo: object, llm: object, logger: object }>} [overrides]
 */
export function createApp(config, overrides = {}) {
  const logger = overrides.logger ?? createLogger(config);
  const scanner = overrides.scanner ?? createScanner(config);
  const repo = overrides.repo ?? createRepository(config);
  const llm = overrides.llm ?? createLlmProvider(config);
  const orchestrator = createOrchestrator({
    scanner,
    repairEngine: createRepairEngine(config),
    verifier: createVerifier(config),
    llm,
    repo,
    config,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS.split(',').map((s) => s.trim()) }));
  app.use(pinoHttp({ logger, genReqId: () => nanoid(10) }));
  app.use(requestTimeout(config.REQUEST_TIMEOUT_MS));
  app.use(express.json({ limit: config.MAX_HTML_BYTES + JSON_OVERHEAD_BYTES }));

  const controllers = {
    health: createHealthController({ scanner, repo, llm, version: VERSION }),
    scans: createScansController(orchestrator),
    usage: createUsageController(orchestrator),
  };
  app.use(createRouter(controllers, { scanLimiter: createRateLimiter(config.RATE_LIMIT_RPM) }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
