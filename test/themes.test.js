import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.ZLOG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'zlog-theme-test-'));

const themes = await import('../src/themes/registry.js');

test('discovers the installed themes and has a default', () => {
  assert.deepEqual(themes.listThemes().map(theme => theme.name), ['default', 'journal']);
  assert.equal(themes.getActiveTheme().name, 'default');
});

test('only declared local CSS assets can be resolved', () => {
  assert.match(themes.getThemeAsset('default', 'theme.css'), /themes\/default\/assets\/theme\.css$/);
  assert.equal(themes.getThemeAsset('default', '../theme.css'), null);
  assert.equal(themes.getThemeAsset('default', 'missing.css'), null);
  assert.equal(themes.getThemeAsset('missing', 'theme.css'), null);
});

test('persists a valid theme selection', () => {
  themes.setActiveTheme('journal');
  assert.equal(themes.getActiveTheme().name, 'journal');
  assert.throws(() => themes.setActiveTheme('missing'), /installed theme/);
});

test('built-in themes define explicit dark and system color modes', () => {
  for (const theme of themes.listThemes()) {
    const stylesheet = fs.readFileSync(themes.getThemeAsset(theme.name, 'theme.css'), 'utf8');
    assert.match(stylesheet, /:root\[data-color-scheme="dark"\]/);
    assert.match(stylesheet, /@media \(prefers-color-scheme: dark\)/);
    assert.match(stylesheet, /:root\[data-color-scheme="system"\]/);
  }
});
