import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {db} from '../database.js';

const themesDirectory = fileURLToPath(new URL('../../themes/', import.meta.url));
const themeNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const manifests = new Map(loadThemes());

export function listThemes() {
  return [...manifests.values()].sort((left, right) => left.label.localeCompare(right.label));
}

export function getActiveTheme() {
  const configuredName = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get()?.value ?? process.env.ZLOG_THEME ?? 'default';
  return getTheme(configuredName) ?? getTheme('default');
}

export function setActiveTheme(name) {
  const theme = getTheme(name);
  if (!theme) {
    throw new Error('Choose an installed theme.');
  }

  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('theme', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(theme.name);
  return theme;
}

export function getTheme(name) {
  return manifests.get(name) ?? null;
}

export function getThemeAsset(themeName, assetName) {
  const theme = getTheme(themeName);
  if (!theme || !theme.assets.includes(assetName)) {
    return null;
  }
  return path.join(theme.assetDirectory, assetName);
}

function loadThemes() {
  const directories = fs.readdirSync(themesDirectory, {withFileTypes: true}).filter(entry => entry.isDirectory());
  const loadedThemes = directories.map(directory => loadTheme(path.join(themesDirectory, directory.name)));

  if (!loadedThemes.some(theme => theme.name === 'default')) {
    throw new Error('A default theme must be installed.');
  }

  return loadedThemes.map(theme => [theme.name, theme]);
}

function loadTheme(themeDirectory) {
  const manifestPath = path.join(themeDirectory, 'theme.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.schemaVersion !== 1 || !themeNamePattern.test(manifest.name) || typeof manifest.label !== 'string' || !Array.isArray(manifest.assets)) {
    throw new Error(`Invalid theme manifest: ${manifestPath}`);
  }
  if (manifest.assets.some(asset => typeof asset !== 'string' || !/^[a-z0-9][a-z0-9._-]*\.css$/.test(asset))) {
    throw new Error(`Theme assets must be local CSS filenames: ${manifestPath}`);
  }
  const assetsDirectory = path.join(themeDirectory, 'assets');
  const resolvedAssetsDirectory = fs.realpathSync(assetsDirectory);
  if (manifest.assets.some(asset => !fs.existsSync(path.join(assetsDirectory, asset)))) {
    throw new Error(`Theme declares a missing asset: ${manifestPath}`);
  }
  if (manifest.assets.some(asset => !fs.statSync(path.join(assetsDirectory, asset)).isFile() || !fs.realpathSync(path.join(assetsDirectory, asset)).startsWith(`${resolvedAssetsDirectory}${path.sep}`))) {
    throw new Error(`Theme assets must remain inside their assets directory: ${manifestPath}`);
  }

  return {
    name: manifest.name,
    label: manifest.label,
    description: String(manifest.description ?? ''),
    assets: manifest.assets,
    assetDirectory: assetsDirectory
  };
}
