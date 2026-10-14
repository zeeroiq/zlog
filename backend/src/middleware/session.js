import {getSession} from '../auth.js';
import {readCookie} from '../lib/cookies.js';

export function loadSession(request, response, next) {
  request.session = getSession(readCookie(request.headers.cookie, 'zlog_session'));
  next();
}
