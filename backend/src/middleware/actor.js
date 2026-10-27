import { readCookie } from '../utils/cookies.js';

export function attachActor(accounts) {
  return async (req, _res, next) => {
    try {
      const token = readCookie(req.headers.cookie, 'accessfix.sid');
      const session = token ? await accounts.readSession(token) : null;
      req.actor = session
        ? { userId: session.userId, email: session.email, plan: session.plan, token }
        : null;
      next();
    } catch (err) {
      next(err);
    }
  };
}
