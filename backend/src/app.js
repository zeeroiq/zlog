import express from 'express';
import {renderNotFound} from './lib/pages.js';
import {loadSession} from './middleware/session.js';
import {authRouter} from './modules/auth/routes.js';
import {apiRouter} from './modules/api/routes.js';
import {dashboardRouter} from './modules/dashboard/routes.js';
import {publicPostsRouter} from './modules/posts/public-routes.js';
import {getActiveTheme, getThemeAsset} from './themes/registry.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.urlencoded({extended: false, limit: '1mb'}));
  app.use(express.json({limit: '1mb'}));
  const publicDirectory = new URL('../public', import.meta.url).pathname;
  app.use(express.static(publicDirectory, {index: false, maxAge: '1h'}));
  app.use('/console', express.static(new URL('../public/console', import.meta.url).pathname, {index: false, maxAge: '1h'}));
  app.get(['/console', '/console/*'], (request, response, next) => {
    response.sendFile(new URL('../public/console/index.html', import.meta.url).pathname, error => error ? next(error) : undefined);
  });
  app.use(loadSession);
  app.use((request, response, next) => {
    request.theme = getActiveTheme();
    next();
  });
  app.get('/themes/:theme/:asset', (request, response, next) => {
    const assetPath = getThemeAsset(request.params.theme, request.params.asset);
    if (!assetPath) {
      return renderNotFound(request, response);
    }
    response.sendFile(assetPath, error => error ? next(error) : undefined);
  });
  app.use('/api', apiRouter);
  app.use(authRouter);
  app.use('/dashboard', dashboardRouter);
  app.use(publicPostsRouter);
  app.use((request, response) => renderNotFound(request, response));

  return app;
}
