import {marked} from 'marked';
import sanitizeHtml from 'sanitize-html';
import {db} from './database.js';

const postColumns = `id, title, slug, body_markdown, status, published_at, created_at, updated_at`;

export function listPublishedPosts() {
  return db.prepare(`SELECT ${postColumns} FROM posts
    WHERE status = 'published' ORDER BY published_at DESC, id DESC`).all();
}

export function getPublishedPost(slug) {
  return db.prepare(`SELECT ${postColumns} FROM posts
    WHERE slug = ? AND status = 'published'`).get(slug);
}

export function listPosts() {
  return db.prepare(`SELECT ${postColumns} FROM posts
    ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END, updated_at DESC, id DESC`).all();
}

export function getPost(id) {
  return db.prepare(`SELECT ${postColumns} FROM posts WHERE id = ?`).get(id);
}

export function createPost(input) {
  const values = normalisePost(input);
  const result = db.prepare(`INSERT INTO posts (title, slug, body_markdown, status, published_at)
    VALUES (@title, @slug, @bodyMarkdown, 'draft', NULL)`).run(values);
  return getPost(result.lastInsertRowid);
}

export function updatePost(id, input) {
  const values = normalisePost(input);
  const result = db.prepare(`UPDATE posts
    SET title = @title, slug = @slug, body_markdown = @bodyMarkdown, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id`).run({...values, id});
  return result.changes ? getPost(id) : null;
}

export function setPostStatus(id, status) {
  const result = db.prepare(`UPDATE posts
    SET status = @status,
      published_at = CASE WHEN @status = 'published' AND published_at IS NULL
        THEN CURRENT_TIMESTAMP WHEN @status = 'draft' THEN NULL ELSE published_at END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id`).run({id, status});
  return result.changes ? getPost(id) : null;
}

export function deletePost(id) {
  return db.prepare('DELETE FROM posts WHERE id = ?').run(id).changes > 0;
}

export function renderMarkdown(markdown) {
  return sanitizeHtml(marked.parse(markdown, {async: false, mangle: false, headerIds: false}), {
    allowedTags: ['a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false
  });
}

export function excerpt(markdown, length = 180) {
  const compact = markdown.replace(/[#>*_`\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();
  return compact.length > length ? `${compact.slice(0, length).trimEnd()}...` : compact;
}

function normalisePost({title, slug, bodyMarkdown}) {
  const cleanTitle = String(title ?? '').trim();
  const cleanSlug = String(slug ?? '').trim().toLowerCase();
  const cleanBody = String(bodyMarkdown ?? '').replace(/\r\n/g, '\n');

  if (!cleanTitle || !cleanSlug) {
    throw new Error('Title and slug are required.');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
    throw new Error('Slug must use lowercase letters, numbers, and single hyphens.');
  }

  return {title: cleanTitle, slug: cleanSlug, bodyMarkdown: cleanBody};
}
