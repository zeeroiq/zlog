function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

export function layout({title, content, session, theme}) {
  const navigation = session
    ? `<a href="/dashboard">Dashboard</a><form method="post" action="/logout" class="inline-form"><input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}"><button type="submit" class="link-button">Sign out</button></form>`
    : `<a href="/login">Sign in</a>`;

  return `<!doctype html>
<html lang="en" data-color-scheme="system">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="A personal blog">
    <title>${escapeHtml(title)} | Zlog</title>
    <script>try{document.documentElement.dataset.colorScheme=localStorage.getItem('zlog-color-scheme')||'system';}catch{}</script>
    <link rel="stylesheet" href="/styles.css">
    ${theme.assets.map(asset => `<link rel="stylesheet" href="/themes/${encodeURIComponent(theme.name)}/${encodeURIComponent(asset)}">`).join('')}
    <script src="/appearance.js" defer></script>
  </head>
  <body>
    <header class="site-header"><a class="brand" href="/">Zlog</a><nav>${appearanceControl()}${navigation}</nav></header>
    <main>${content}</main>
    <footer>Published with Zlog</footer>
  </body>
</html>`;
}

function appearanceControl() {
  return `<fieldset class="appearance-control"><legend class="sr-only">Appearance</legend><label><input type="radio" name="appearance" value="system" checked><span>System</span></label><label><input type="radio" name="appearance" value="light"><span>Light</span></label><label><input type="radio" name="appearance" value="dark"><span>Dark</span></label></fieldset>`;
}

export function home(posts, excerpt) {
  const cards = posts.length
    ? posts.map(post => `<article class="post-summary">
      <p class="meta">${formatDate(post.published_at)}</p>
      <h2><a href="/posts/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)}</a></h2>
      <p>${escapeHtml(excerpt(post.body_markdown))}</p>
    </article>`).join('')
    : '<p class="empty">No posts have been published yet.</p>';
  return `<section class="intro"><h1>Notes from Zlog</h1></section><section>${cards}</section>`;
}

export function publicPost(post, html) {
  return `<article class="post"><p class="meta">${formatDate(post.published_at)}</p><h1>${escapeHtml(post.title)}</h1><div class="post-body">${html}</div></article>`;
}

export function login(error = '') {
  return `<section class="auth"><h1>Sign in</h1>${message(error, 'error')}<form method="post" action="/login">
    <label>Email<input name="email" type="email" autocomplete="email" required></label>
    <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
    <button type="submit">Sign in</button>
  </form></section>`;
}

export function dashboard(posts, session, notice = '', themes = [], activeTheme = '') {
  const rows = posts.length ? posts.map(post => `<tr>
    <td><a href="/dashboard/posts/${post.id}/edit">${escapeHtml(post.title)}</a></td>
    <td>${escapeHtml(post.status)}</td>
    <td>${post.published_at ? formatDate(post.published_at) : 'Not published'}</td>
    <td class="actions">
      <a href="/dashboard/posts/${post.id}/edit">Edit</a>
      <form method="post" action="/dashboard/posts/${post.id}/status" class="inline-form">
        <input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}">
        <input type="hidden" name="status" value="${post.status === 'published' ? 'draft' : 'published'}">
        <button type="submit" class="link-button">${post.status === 'published' ? 'Unpublish' : 'Publish'}</button>
      </form>
      <form method="post" action="/dashboard/posts/${post.id}/delete" class="inline-form" onsubmit="return confirm('Delete this post?');">
        <input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}">
        <button type="submit" class="link-button danger">Delete</button>
      </form>
    </td>
  </tr>`).join('') : '<tr><td colspan="4">No posts yet.</td></tr>';
  const options = themes.map(theme => `<option value="${escapeHtml(theme.name)}"${theme.name === activeTheme ? ' selected' : ''}>${escapeHtml(theme.label)}</option>`).join('');
  return `<section class="dashboard-heading"><div><h1>Posts</h1><p>${escapeHtml(session.email)}</p></div><a class="button" href="/dashboard/posts/new">New post</a></section>${message(notice, 'notice')}<section class="theme-picker"><form method="post" action="/dashboard/theme"><input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}"><label>Theme<select name="theme">${options}</select></label><button type="submit">Apply</button></form></section><table><thead><tr><th>Title</th><th>Status</th><th>Published</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function postForm({post, session, error = '', isNew = false}) {
  const action = isNew ? '/dashboard/posts' : `/dashboard/posts/${post.id}`;
  const heading = isNew ? 'New post' : 'Edit post';
  return `<section class="editor"><div class="editor-heading"><h1>${heading}</h1><a href="/dashboard">Back to posts</a></div>${message(error, 'error')}<form method="post" action="${action}">
    <input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}">
    <label>Title<input name="title" value="${escapeHtml(post.title)}" required autofocus></label>
    <label>Slug<input name="slug" value="${escapeHtml(post.slug)}" pattern="[a-z0-9]+(-[a-z0-9]+)*" required></label>
    <label>Body <span class="hint">Markdown</span><textarea name="bodyMarkdown" rows="22">${escapeHtml(post.body_markdown)}</textarea></label>
    <button type="submit">${isNew ? 'Create draft' : 'Save changes'}</button>
  </form></section>`;
}

export function message(text, kind) {
  return text ? `<p class="message ${kind}">${escapeHtml(text)}</p>` : '';
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en', {dateStyle: 'long'}).format(new Date(value));
}
