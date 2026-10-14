import {renderPage} from '../lib/pages.js';

export function requireOwner(request, response, next) {
  if (!request.session) {
    return response.redirect('/login');
  }
  next();
}

export function requireCsrf(request, response, next) {
  if (!request.session || request.body._csrf !== request.session.csrf_token) {
    return response.status(403).send(renderPage(request, 'Forbidden', '<h1>Forbidden</h1><p>Your form has expired. Please sign in again.</p>'));
  }
  next();
}
