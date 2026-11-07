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
  return `<section class="intro"><h1>Notes from Zlog</h1></section><section>${cards}</section>${subscribeForm()}`;
}

function subscribeForm() {
  return `<section class="subscribe-section">
  <h2>Stay in the loop</h2>
  <p class="subscribe-desc">Get new posts delivered straight to your inbox.</p>
  <form class="subscribe-form" id="subscribe-form">
    <label class="sr-only" for="subscribe-email">Email address</label>
    <input id="subscribe-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required>
    <button type="submit">Subscribe</button>
  </form>
  <p class="subscribe-feedback" id="subscribe-feedback" aria-live="polite"></p>
</section>
<script>
(function () {
  const form = document.getElementById('subscribe-form');
  const feedback = document.getElementById('subscribe-feedback');
  if (!form) return;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const email = form.email.value.trim();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    feedback.textContent = '';
    feedback.className = 'subscribe-feedback';
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email}),
        credentials: 'same-origin'
      });
      const data = await res.json();
      if (res.ok) {
        feedback.textContent = data.message ?? 'Subscribed! Thank you.';
        feedback.className = 'subscribe-feedback notice';
        form.reset();
      } else {
        feedback.textContent = data.error ?? 'Something went wrong. Please try again.';
        feedback.className = 'subscribe-feedback error';
      }
    } catch (_) {
      feedback.textContent = 'Network error. Please try again.';
      feedback.className = 'subscribe-feedback error';
    } finally {
      btn.disabled = false;
    }
  });
}());
</script>`;
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

export function dashboard(posts, session, notice = '', themes = [], activeTheme = '', analytics = {}, subscribers = []) {
  // Per-post view map: slug -> { views, unique_visitors, repeat_views, returning_visitors }
  const postViewMap = Object.fromEntries(
    (analytics.postViews ?? []).map(pv => [pv.slug, pv])
  );

  const rows = posts.length ? posts.map(post => {
    const pv = postViewMap[post.slug] ?? {views: 0, unique_visitors: 0, repeat_views: 0};
    return `<tr>
    <td><a href="/dashboard/posts/${post.id}/edit">${escapeHtml(post.title)}</a></td>
    <td>${escapeHtml(post.status)}</td>
    <td>${post.published_at ? formatDate(post.published_at) : 'Not published'}</td>
    <td class="num">${pv.views}</td>
    <td class="num">${pv.unique_visitors}</td>
    <td class="num">${pv.repeat_views ?? 0}</td>
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
  </tr>`;
  }).join('') : '<tr><td colspan="7">No posts yet.</td></tr>';

  const options = themes.map(theme => `<option value="${escapeHtml(theme.name)}"${theme.name === activeTheme ? ' selected' : ''}>${escapeHtml(theme.label)}</option>`).join('');

  const totalViews = analytics.totalViews ?? 0;
  const uniqueVisitors = analytics.uniqueVisitors ?? 0;
  const returningVisitors = analytics.returningVisitors ?? 0;
  const repeatViews = analytics.repeatViews ?? 0;
  const subscriberCount = analytics.subscriberCount ?? 0;
  const devices = analytics.devices ?? {desktop: 0, mobile: 0, tablet: 0};
  const countries = analytics.countries ?? [];
  const visitors = analytics.visitors ?? [];
  const recentActivity = analytics.recentActivity ?? [];

  const vPage = analytics.vPage ?? 1;
  const aPage = analytics.aPage ?? 1;
  const pageSize = analytics.pageSize ?? 10;
  const totalVisitors = analytics.totalVisitors ?? visitors.length;
  const totalActivity = analytics.totalActivity ?? recentActivity.length;

  const statsBar = `<section class="stats-bar">
    <div class="stat-card"><span class="stat-value">${totalViews}</span><span class="stat-label">Total views</span></div>
    <div class="stat-card"><span class="stat-value">${uniqueVisitors}</span><span class="stat-label">Unique visitors</span></div>
    <div class="stat-card"><span class="stat-value">${returningVisitors}</span><span class="stat-label">Returning visitors</span></div>
    <div class="stat-card"><span class="stat-value">${repeatViews}</span><span class="stat-label">Repeat views</span></div>
    <div class="stat-card"><span class="stat-value">${subscriberCount}</span><span class="stat-label">Subscribers</span></div>
  </section>
  <section class="device-bar">
    <span class="device-label">Devices —</span>
    <span class="device-pill">🖥 Desktop <strong>${devices.desktop}</strong></span>
    <span class="device-pill">📱 Mobile <strong>${devices.mobile}</strong></span>
    <span class="device-pill">⬜ Tablet <strong>${devices.tablet}</strong></span>
  </section>
  ${countries.length ? `<section class="country-bar">
    <span class="device-label">Locations —</span>
    ${countries.map(c => `<span class="device-pill">${escapeHtml(c.formatted)} <strong>${c.views}</strong></span>`).join(' ')}
  </section>` : ''}`;

  const visitorRows = visitors.length
    ? visitors.map(v => {
      const badge = v.is_returning
        ? `<span class="badge badge-returning">Returning (${v.total_visits}x)</span>`
        : `<span class="badge badge-new">New (1x)</span>`;
      return `<tr>
          <td><code>${escapeHtml(v.ip_address)}</code></td>
          <td>${escapeHtml(v.location || '—')}</td>
          <td>${escapeHtml(v.os)} · ${escapeHtml(v.browser)}</td>
          <td>${escapeHtml(v.device_type)}</td>
          <td>${badge}</td>
          <td class="num">${v.unique_pages}</td>
          <td>${formatDateTime(v.last_seen)}</td>
          <td class="actions">
            <form method="post" action="/dashboard/analytics/visitors/${encodeURIComponent(v.visitor_id)}/delete" class="inline-form" onsubmit="return confirm('Delete all records for this visitor?');">
              <input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}">
              <button type="submit" class="link-button danger">Delete</button>
            </form>
          </td>
        </tr>`;
    }).join('')
    : '<tr><td colspan="8">No visitor traffic recorded yet.</td></tr>';

  const activityRows = recentActivity.length
    ? recentActivity.map(a => {
      const badge = a.is_returning
        ? `<span class="badge badge-returning">Returning (#${a.visit_number})</span>`
        : `<span class="badge badge-new">New</span>`;
      const pageRepeatBadge = a.is_page_repeat
        ? `<span class="badge badge-repeat">Page repeat</span>`
        : '';
      return `<tr>
          <td>${formatDateTime(a.viewed_at)}</td>
          <td><code>${escapeHtml(a.path)}</code></td>
          <td><code>${escapeHtml(a.ip_address)}</code></td>
          <td>${escapeHtml(a.location || '—')}</td>
          <td>${escapeHtml(a.os)} · ${escapeHtml(a.browser)}</td>
          <td>${badge} ${pageRepeatBadge}</td>
          <td class="actions">
            <form method="post" action="/dashboard/analytics/views/${a.id}/delete" class="inline-form" onsubmit="return confirm('Delete this record?');">
              <input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}">
              <button type="submit" class="link-button danger">Delete</button>
            </form>
          </td>
        </tr>`;
    }).join('')
    : '<tr><td colspan="7">No recent activity yet.</td></tr>';

  const subscriberRows = subscribers.length
    ? subscribers.map(sub => `<tr>
        <td>${escapeHtml(sub.email)}</td>
        <td>${formatDate(sub.subscribed_at)}</td>
        <td class="actions">
          <form method="post" action="/dashboard/subscribers/${sub.id}/delete" class="inline-form" onsubmit="return confirm('Remove subscriber?');">
            <input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}">
            <button type="submit" class="link-button danger">Remove</button>
          </form>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="3">No subscribers yet.</td></tr>';

  const visitorPagination = renderPagination(vPage, totalVisitors, pageSize, 'vPage', `&aPage=${aPage}`);
  const activityPagination = renderPagination(aPage, totalActivity, pageSize, 'aPage', `&vPage=${vPage}`);

  return `<section class="dashboard-heading"><div><h1>Posts</h1><p>${escapeHtml(session.email)}</p></div><a class="button" href="/dashboard/posts/new">New post</a></section>${message(notice, 'notice')}${statsBar}<section class="theme-picker"><form method="post" action="/dashboard/theme"><input type="hidden" name="_csrf" value="${escapeHtml(session.csrf_token)}"><label>Theme<select name="theme">${options}</select></label><button type="submit">Apply</button></form></section>
<section>
  <h2>Posts &amp; Page Views</h2>
  <div class="shadow-scroll-container">
    <table><thead><tr><th>Title</th><th>Status</th><th>Published</th><th>Views</th><th>Unique</th><th>Repeat</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>
  </div>
</section>

<section class="analytics-section">
  <h2>Identified Visitors &amp; Nodes</h2>
  <p class="section-hint">Identifies repeat systems, locations, and nodes with shadow scrolling &amp; pagination.</p>
  <div class="shadow-scroll-container">
    <table><thead><tr><th>Node / IP</th><th>Location</th><th>System (OS &amp; Browser)</th><th>Device</th><th>Visits</th><th>Pages</th><th>Last Seen</th><th>Actions</th></tr></thead><tbody>${visitorRows}</tbody></table>
  </div>
  ${visitorPagination}
</section>

<section class="analytics-section">
  <h2>Recent Activity Stream</h2>
  <p class="section-hint">Real-time log of page views with location and returning visitor status.</p>
  <div class="shadow-scroll-container">
    <table><thead><tr><th>Time</th><th>Page</th><th>Node / IP</th><th>Location</th><th>System</th><th>Visit Status</th><th>Actions</th></tr></thead><tbody>${activityRows}</tbody></table>
  </div>
  ${activityPagination}
</section>

<section class="subscribers-section">
  <h2>Newsletter subscribers</h2>
  <div class="shadow-scroll-container">
    <table><thead><tr><th>Email</th><th>Subscribed</th><th>Actions</th></tr></thead><tbody>${subscriberRows}</tbody></table>
  </div>
</section>`;
}

function renderPagination(currentPage, totalItems, pageSize, paramName, otherParams) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return '';
  const prev = currentPage > 1
    ? `<a class="page-link" href="?${paramName}=${currentPage - 1}${otherParams}">&larr; Prev</a>`
    : `<span class="page-link disabled">&larr; Prev</span>`;
  const next = currentPage < totalPages
    ? `<a class="page-link" href="?${paramName}=${currentPage + 1}${otherParams}">Next &rarr;</a>`
    : `<span class="page-link disabled">Next &rarr;</span>`;
  return `<div class="pagination-bar">
    <span>Showing page ${currentPage} of ${totalPages} (${totalItems} total)</span>
    <div class="pagination-links">${prev} ${next}</div>
  </div>`;
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

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
}
