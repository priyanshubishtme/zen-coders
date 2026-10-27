import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

export function testApp(overrides = {}) {
  const config = loadConfig({ NODE_ENV: 'test' });
  return createApp(config, overrides);
}
