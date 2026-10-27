import { shareLive } from '../services/access/decide.js';
import { hashPassword, verifyPassword } from '../services/auth/password.js';
import { AppError } from '../utils/errors.js';
import { sessionCookie } from '../utils/cookies.js';

let dummyHash;
async function dummy() {
  dummyHash ??= await hashPassword('not-a-real-password-value');
  return dummyHash;
}

function proSet(config) {
  return new Set(
    config.PRO_EMAILS.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * @param {{ accounts: object, orchestrator: object, config: object }} deps
 */
export function createAuthController({ accounts, orchestrator, config }) {
  const pros = proSet(config);

  async function publicUser(email) {
    const user = await accounts.findUserByEmail(email);
    return { email: user.email, plan: user.plan, projects: await accounts.listProjects(user.id) };
  }

  return {
    async signup(req, res) {
      const attempts = await accounts.bumpHour('signup-ip', req.ip || 'local');
      if (attempts > config.SIGNUP_IP_PER_HOUR) {
        throw new AppError('RATE_LIMITED', 'Too many new accounts from this network. Try again later.', {
          retryAfterSec: 3600,
        });
      }
      const { email, password } = req.valid.body;
      const plan = pros.has(email) ? 'pro' : 'free';
      const created = await accounts.createUser({ email, password, plan });
      if (!created) throw new AppError('VALIDATION_ERROR', 'Could not create an account with that email.');
      const session = await accounts.createSession(created.id);
      res.set('Set-Cookie', sessionCookie(config, session.token));
      res.status(201).json({ email: created.email, plan: created.plan, projects: created.projects });
    },

    async login(req, res) {
      const { email, password } = req.valid.body;
      const attempts = await accounts.bumpHour('login-ip', req.ip || 'local');
      if (attempts > config.LOGIN_IP_PER_HOUR) {
        throw new AppError('RATE_LIMITED', 'Too many sign-in attempts from this network. Try again later.', {
          retryAfterSec: 3600,
        });
      }
      const gate = await accounts.loginGate(email);
      if (gate.waitMs > 0) {
        throw new AppError('RATE_LIMITED', 'Too many sign-in attempts. Try again shortly.', {
          retryAfterSec: Math.max(1, Math.ceil(gate.waitMs / 1000)),
        });
      }
      const user = await accounts.findUserByEmail(email);
      const ok = await verifyPassword(password, user?.passwordHash ?? (await dummy()));
      if (!user || !ok) {
        await accounts.recordLoginFailure(email);
        throw new AppError('AUTH_REQUIRED', 'Invalid email or password.');
      }
      await accounts.clearLoginFailures(email);
      if (pros.has(user.email) && user.plan !== 'pro') await accounts.setPlan(user.email, 'pro');
      const session = await accounts.rotateSession(user.id);
      res.set('Set-Cookie', sessionCookie(config, session.token));
      res.json(await publicUser(email));
    },

    async logout(req, res) {
      if (req.actor?.token) await accounts.deleteSession(req.actor.token);
      res.set('Set-Cookie', sessionCookie(config, '', { clear: true }));
      res.status(204).end();
    },

    async me(req, res) {
      if (!req.actor) throw new AppError('AUTH_REQUIRED', 'Sign in to continue.');
      const scans = await accounts.scansFor(req.actor.userId);
      res.json({
        email: req.actor.email,
        plan: req.actor.plan,
        projects: await accounts.listProjects(req.actor.userId),
        scanIds: scans,
      });
    },

    async shareReport(req, res) {
      const share = await liveShare(accounts, req.valid.params.token);
      const report = await orchestrator.getReport(share.scanId);
      res.set('Cache-Control', 'no-store');
      res.set('Referrer-Policy', 'no-referrer');
      res.json(report);
    },

    async shareEvents(req, res) {
      const share = await liveShare(accounts, req.valid.params.token);
      const scan = await orchestrator.getScan(share.scanId);
      writeEvents(req, res, orchestrator, scan);
    },

    async shareScreenshot(req, res) {
      const share = await liveShare(accounts, req.valid.params.token);
      const buf = await orchestrator.getScreenshot(share.scanId, req.valid.query.which);
      res.set('Cache-Control', 'no-store');
      res.set('Referrer-Policy', 'no-referrer');
      res.set('Cross-Origin-Resource-Policy', 'cross-origin');
      res.set('X-Content-Type-Options', 'nosniff');
      res.type('image/jpeg').send(buf);
    },

    async revoke(req, res) {
      if (!req.actor) throw new AppError('AUTH_REQUIRED', 'Sign in to continue.');
      await accounts.revokeShare(req.valid.params.token, req.actor.userId);
      res.status(204).end();
    },
  };
}

async function liveShare(accounts, token) {
  const share = await accounts.readShare(token);
  if (!shareLive(share)) throw new AppError('NOT_FOUND', 'Scan not found. It may have expired.');
  return share;
}

function writeEvents(req, res, orchestrator, scan) {
  res.status(200);
  res.set('Content-Type', 'text/event-stream; charset=utf-8');
  res.set('Cache-Control', 'no-store, no-transform');
  res.set('Connection', 'keep-alive');
  res.set('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  const send = (event) => {
    if (!res.writableEnded) res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const unsub = orchestrator.watchEvents(scan.id, send, req.get('last-event-id') || undefined);
  if (scan.status === 'completed' || scan.status === 'failed') {
    unsub();
    return res.end();
  }
  req.on('close', () => {
    unsub();
    if (!res.writableEnded) res.end();
  });
}

export { writeEvents };
