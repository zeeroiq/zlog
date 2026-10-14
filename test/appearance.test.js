import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const publicDirectory = path.resolve('public');
const viewsPath = path.resolve('src/views.js');

test('appearance control supports system, light, and dark choices', () => {
  const source = fs.readFileSync(viewsPath, 'utf8');
  for (const scheme of ['system', 'light', 'dark']) {
    assert.match(source, new RegExp(`value=\\"${scheme}\\"`));
  }
  assert.match(source, /data-color-scheme="system"/);
});

test('appearance preference is applied and persisted client-side', () => {
  const source = fs.readFileSync(path.join(publicDirectory, 'appearance.js'), 'utf8');
  assert.match(source, /localStorage\.getItem\(storageKey\)/);
  assert.match(source, /localStorage\.setItem\(storageKey, scheme\)/);
  assert.match(source, /document\.documentElement\.dataset\.colorScheme = scheme/);
});
