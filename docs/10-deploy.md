# 10. Deploy

Two processes. The UI is static files. The API needs a machine that can run Chromium.

## Frontend (static)

```bash
npm run build -w frontend
```

Host `frontend/dist` on Vercel, Netlify, Cloudflare Pages, or any static origin. Set
`VITE_API_BASE_URL` at build time to the public API origin (no trailing slash).

The SPA uses the History API (`/history`, `/business`, `/scans/:id/report`). Configure the host
to serve `index.html` for those paths.

## Backend (Chromium)

Use the root `Dockerfile` (Playwright Ubuntu image, Chromium already installed).

Required environment:

| Variable | Notes |
| -------- | ----- |
| `CORS_ORIGINS` | The static UI origin |
| `TRUST_PROXY` | `true` behind Render/Fly/Cloud Run |
| `STORE` | `memory` (default) or `mongo` |
| `MONGODB_URI` | Required when `STORE=mongo` |
| `ALLOW_PRIVATE_URLS` | Must stay false in production (startup refuses it) |
| `LLM_*` | Optional; product works with `LLM_PROVIDER=none` |

Do not run the API on a serverless platform that cannot keep a browser process.

## Mongo

`STORE=memory` is the demo default. For persistence:

```bash
docker compose up -d mongo
# .env
STORE=mongo
MONGODB_URI=mongodb://127.0.0.1:27017/accessfix
```

Scans, repairs and verifications expire after `SCAN_TTL_DAYS` (default 30) so the Atlas free
tier does not fill and shared report links die.

Contract tests against Mongo (CI skips them without a URI):

```bash
docker compose up -d mongo
MONGODB_URI=mongodb://127.0.0.1:27017/accessfix_test npm run test:unit -w backend
```

## One-command local

```bash
npm install
npm run browsers:install
npm run dev
```

Open http://localhost:5173. Docker is not required for that path.
