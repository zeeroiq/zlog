import {Router} from 'express';
import {renderNotFound, renderPage} from '../../lib/pages.js';
import {requireCsrf, requireOwner} from '../../middleware/owner.js';
import {createPost, deletePost, getPost, listPosts, setPostStatus, updatePost} from '../../posts.js';
import {listThemes, setActiveTheme} from '../../themes/registry.js';
import {dashboard, postForm} from '../../views.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireOwner);

dashboardRouter.get('/', (request, response) => {
  response.send(renderPage(request, 'Dashboard', dashboard(listPosts(), request.session, request.query.notice, listThemes(), request.theme.name)));
});

dashboardRouter.post('/theme', requireCsrf, (request, response) => {
  try {
    setActiveTheme(request.body.theme);
    response.redirect('/dashboard?notice=Theme%20updated.');
  } catch (error) {
    response.redirect(`/dashboard?notice=${encodeURIComponent(error.message)}`);
  }
});

dashboardRouter.get('/posts/new', (request, response) => {
  response.send(renderPage(request, 'New post', postForm({post: emptyPost(), session: request.session, isNew: true})));
});

dashboardRouter.post('/posts', requireCsrf, (request, response) => {
  try {
    const post = createPost(request.body);
    response.redirect(`/dashboard/posts/${post.id}/edit?notice=${encodeURIComponent('Draft created.')}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'New post', postForm({post: fromBody(request.body), session: request.session, error: formError(error), isNew: true})));
  }
});

dashboardRouter.get('/posts/:id/edit', (request, response) => {
  const post = getPost(request.params.id);
  if (!post) {
    return renderNotFound(request, response);
  }
  response.send(renderPage(request, 'Edit post', postForm({post, session: request.session, error: request.query.notice ?? ''})));
});

dashboardRouter.post('/posts/:id', requireCsrf, (request, response) => {
  const post = getPost(request.params.id);
  if (!post) {
    return renderNotFound(request, response);
  }
  try {
    updatePost(post.id, request.body);
    response.redirect(`/dashboard/posts/${post.id}/edit?notice=${encodeURIComponent('Changes saved.')}`);
  } catch (error) {
    response.status(400).send(renderPage(request, 'Edit post', postForm({post: {...fromBody(request.body), id: post.id}, session: request.session, error: formError(error)})));
  }
});

dashboardRouter.post('/posts/:id/status', requireCsrf, (request, response) => {
  const status = request.body.status;
  if (status !== 'draft' && status !== 'published') {
    return response.status(400).send('Invalid post status.');
  }
  if (!setPostStatus(request.params.id, status)) {
    return renderNotFound(request, response);
  }
  response.redirect(`/dashboard?notice=${encodeURIComponent(status === 'published' ? 'Post published.' : 'Post returned to draft.')}`);
});

dashboardRouter.post('/posts/:id/delete', requireCsrf, (request, response) => {
  if (!deletePost(request.params.id)) {
    return renderNotFound(request, response);
  }
  response.redirect('/dashboard?notice=Post%20deleted.');
});

function emptyPost() {
  return {title: '', slug: '', body_markdown: ''};
}

function fromBody(body) {
  return {title: body.title ?? '', slug: body.slug ?? '', body_markdown: body.bodyMarkdown ?? ''};
}

function formError(error) {
  return error.code?.startsWith('SQLITE_CONSTRAINT') ? 'That slug is already in use.' : error.message;
}
