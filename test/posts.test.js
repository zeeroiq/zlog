import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.ZLOG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'zlog-test-'));

const posts = await import('../src/posts.js');

test('posts stay private until published', () => {
  const post = posts.createPost({title: 'A draft', slug: 'a-draft', bodyMarkdown: 'Private notes'});

  assert.equal(posts.getPublishedPost('a-draft'), undefined);
  assert.equal(posts.listPublishedPosts().length, 0);

  posts.setPostStatus(post.id, 'published');

  assert.equal(posts.getPublishedPost('a-draft').title, 'A draft');
  assert.equal(posts.listPublishedPosts().length, 1);
});

test('slugs are constrained and unique', () => {
  posts.createPost({title: 'One', slug: 'one', bodyMarkdown: ''});

  assert.throws(() => posts.createPost({title: 'Two', slug: 'one', bodyMarkdown: ''}));
  assert.throws(() => posts.createPost({title: 'Bad', slug: 'Not a slug', bodyMarkdown: ''}), /Slug must use/);
});

test('rendered Markdown drops scripts and unsafe links', () => {
  const html = posts.renderMarkdown('[bad](javascript:alert(1))\n\n<script>alert(1)</script>\n\n**safe**');

  assert.doesNotMatch(html, /script|javascript:/i);
  assert.match(html, /<strong>safe<\/strong>/);
});
