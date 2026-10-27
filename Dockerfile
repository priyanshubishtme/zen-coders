# Backend image: Chromium is already in the Playwright base.
# Frontend is a static Vite build — host it separately (see docs/10-deploy.md).
FROM mcr.microsoft.com/playwright:v1.64.1-jammy

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --omit=dev -w backend --include-workspace-root

COPY backend ./backend
COPY samples ./samples
COPY docs ./docs

WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "src/server.js"]
