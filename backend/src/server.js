import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const app = createApp(config);
await app.locals.repo?.ready;
await app.locals.accounts?.ready;
await app.locals.vault?.sweep()?.catch(() => {});

const server = app.listen(config.PORT, () => {
  console.log(`AccessFix API listening on http://localhost:${config.PORT}`);
  if (config.ALLOW_PRIVATE_URLS) {
    console.warn('ALLOW_PRIVATE_URLS=true: private network scanning is enabled (dev only).');
  }
});

async function shutdown() {
  server.close();
  await app.locals.orchestrator.idle();
  await app.locals.scanner.close();
  await app.locals.repo?.close?.();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, shutdown);
