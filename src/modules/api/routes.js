import {Router} from 'express';
import {clearExpiredSessions, createSession, destroySession, verifyPassword} from '../../auth.js';
import {db} from '../../database.js';
import {readCookie, sessionCookieOptions} from '../../lib/cookies.js';
import {createPost, deletePost, getPost, getPublishedPost, listPosts, listPublishedPosts, setPostStatus, updatePost} from '../../posts.js';
import {listThemes, setActiveTheme} from '../../themes/registry.js';

export const apiRouter = Router();

apiRouter.get('/session', (request, response) => response.json({user: request.session ? {email: request.session.email} : null, csrfToken: request.session?.csrf_token ?? null, themes: listThemes().map(({name, label, description}) => ({name, label, description})), activeTheme: request.theme.name}));
apiRouter.post('/login', async (request, response) => {
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(String(request.body.email ?? '').trim().toLowerCase());
  if (!user || !await verifyPassword(String(request.body.password ?? ''), user.password_hash)) return response.status(401).json({error: 'Email or password is incorrect.'});
  clearExpiredSessions();
  const session = createSession(user.id);
  response.cookie('zlog_session', session.token, sessionCookieOptions(session.expiresAt));
  response.json({user: {email: user.email}, csrfToken: session.csrfToken});
});
apiRouter.post('/logout', owner, csrf, (request, response) => { destroySession(readCookie(request.headers.cookie, 'zlog_session')); response.clearCookie('zlog_session', {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/'}); response.status(204).end(); });
apiRouter.get('/posts', (request, response) => response.json(listPublishedPosts()));
apiRouter.get('/posts/:slug', (request, response) => { const post = getPublishedPost(request.params.slug); return post ? response.json(post) : response.status(404).json({error: 'Not found'}); });
apiRouter.get('/admin/posts', owner, (request, response) => response.json(listPosts()));
apiRouter.post('/admin/posts', owner, csrf, (request, response) => mutate(response, () => createPost(request.body), 201));
apiRouter.put('/admin/posts/:id', owner, csrf, (request, response) => mutate(response, () => updatePost(request.params.id, request.body)));
apiRouter.post('/admin/posts/:id/status', owner, csrf, (request, response) => { const post = setPostStatus(request.params.id, request.body.status); return post ? response.json(post) : response.status(404).json({error: 'Not found'}); });
apiRouter.delete('/admin/posts/:id', owner, csrf, (request, response) => deletePost(request.params.id) ? response.status(204).end() : response.status(404).json({error: 'Not found'}));
apiRouter.post('/admin/theme', owner, csrf, (request, response) => mutate(response, () => setActiveTheme(request.body.theme)));

function owner(request, response, next) { return request.session ? next() : response.status(401).json({error: 'Sign in required.'}); }
function csrf(request, response, next) { return request.headers['x-csrf-token'] === request.session?.csrf_token ? next() : response.status(403).json({error: 'Invalid CSRF token.'}); }
function mutate(response, action, status = 200) { try { const value = action(); return value ? response.status(status).json(value) : response.status(404).json({error: 'Not found'}); } catch (error) { return response.status(400).json({error: error.code?.startsWith('SQLITE_CONSTRAINT') ? 'That slug is already in use.' : error.message}); } }
