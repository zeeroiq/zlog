import {Router} from 'express';
import {clearExpiredSessions, createSession, destroySession, verifyPassword} from '../../auth.js';
import {db} from '../../database.js';
import {readCookie, sessionCookieOptions} from '../../lib/cookies.js';
import {renderPage} from '../../lib/pages.js';
import {requireCsrf, requireOwner} from '../../middleware/owner.js';
import {login} from '../../views.js';

export const authRouter = Router();

authRouter.get('/login', (request, response) => {
  if (request.session) {
    return response.redirect('/dashboard');
  }
  response.send(renderPage(request, 'Sign in', login()));
});

authRouter.post('/login', async (request, response) => {
  const email = String(request.body.email ?? '').trim().toLowerCase();
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  if (!user || !await verifyPassword(String(request.body.password ?? ''), user.password_hash)) {
    return response.status(401).send(renderPage(request, 'Sign in', login('Email or password is incorrect.')));
  }

  clearExpiredSessions();
  const session = createSession(user.id);
  response.cookie('zlog_session', session.token, sessionCookieOptions(session.expiresAt));
  response.redirect('/dashboard');
});

authRouter.post('/logout', requireOwner, requireCsrf, (request, response) => {
  destroySession(readCookie(request.headers.cookie, 'zlog_session'));
  response.clearCookie('zlog_session', {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/'});
  response.redirect('/');
});
