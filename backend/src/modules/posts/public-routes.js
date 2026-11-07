import {Router} from 'express';
import {renderNotFound, renderPage} from '../../lib/pages.js';
import {excerpt, getPublishedPost, listPublishedPosts, renderMarkdown} from '../../posts.js';
import {home, publicPost} from '../../views.js';
import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_OPTIONS,
  recordPageView,
  resolveVisitor,
} from '../analytics/analytics.js';

export const publicPostsRouter = Router();

/**
 * Middleware: resolve (or mint) the visitor UUID, attach it to the request,
 * and set the cookie on the response when it is newly created.
 */
function trackVisitor(request, response, next) {
  const {visitorId, isNew} = resolveVisitor(request);
  request.visitorId = visitorId;
  if (isNew) {
    response.cookie(VISITOR_COOKIE, visitorId, VISITOR_COOKIE_OPTIONS);
  }
  next();
}

/**
 * Records a page view with node and system context.
 * @param {import('express').Request} request
 * @param {string} path
 */
function track(request, path) {
  const rawIp = request.headers['x-forwarded-for'] ?? request.headers['x-real-ip'] ?? request.socket?.remoteAddress;
  recordPageView({
    path,
    visitorId: request.visitorId,
    ipAddress: rawIp,
    userAgent: request.headers['user-agent'],
    headers: request.headers,
  });
}

publicPostsRouter.use(trackVisitor);

publicPostsRouter.get('/', (request, response) => {
  track(request, '/');
  response.send(renderPage(request, 'Home', home(listPublishedPosts(), excerpt)));
});

publicPostsRouter.get('/posts/:slug', (request, response) => {
  const post = getPublishedPost(request.params.slug);
  if (!post) {
    return renderNotFound(request, response);
  }
  track(request, `/posts/${request.params.slug}`);
  response.send(renderPage(request, post.title, publicPost(post, renderMarkdown(post.body_markdown))));
});
