import {layout} from '../views.js';

export function renderPage(request, title, content) {
  return layout({title, content, session: request.session, theme: request.theme});
}

export function renderNotFound(request, response) {
  response.status(404).send(renderPage(request, 'Not found', '<section><h1>Not found</h1><p>The page you requested does not exist.</p></section>'));
}
