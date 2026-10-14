import {Router} from 'express';
import {renderNotFound, renderPage} from '../../lib/pages.js';
import {excerpt, getPublishedPost, listPublishedPosts, renderMarkdown} from '../../posts.js';
import {home, publicPost} from '../../views.js';

export const publicPostsRouter = Router();

publicPostsRouter.get('/', (request, response) => {
  response.send(renderPage(request, 'Home', home(listPublishedPosts(), excerpt)));
});

publicPostsRouter.get('/posts/:slug', (request, response) => {
  const post = getPublishedPost(request.params.slug);
  if (!post) {
    return renderNotFound(request, response);
  }
  response.send(renderPage(request, post.title, publicPost(post, renderMarkdown(post.body_markdown))));
});
