import {createHash, randomUUID} from 'node:crypto';
import {db} from '../../database.js';

// ---------------------------------------------------------------------------
// Visitor cookie helpers
// ---------------------------------------------------------------------------

export const VISITOR_COOKIE = 'zlog_vid';

/** One-year TTL for the visitor tracking cookie. */
export const VISITOR_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365, // 1 year in seconds
  path: '/',
};

/**
 * Reads or mints a visitor UUID from the request cookie.
 * Returns { visitorId, isNew } where isNew=true means the cookie was just
 * created and must be set on the response.
 * @param {import('express').Request} request
 * @returns {{ visitorId: string, isNew: boolean }}
 */
export function resolveVisitor(request) {
  const existing = readCookieValue(request.headers.cookie, VISITOR_COOKIE);
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) {
    return {visitorId: existing, isNew: false};
  }
  return {visitorId: randomUUID(), isNew: true};
}

// ---------------------------------------------------------------------------
// IP & system / device identification helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes an IP string (handling x-forwarded-for lists, IPv6-mapped IPv4, loopback).
 * @param {string|undefined} rawIp
 * @returns {string}
 */
export function normalizeIp(rawIp) {
  if (!rawIp) return '127.0.0.1';
  // Take first IP if comma-separated (client behind proxies)
  let ip = String(rawIp).split(',')[0].trim();
  // Strip IPv4 mapped into IPv6 (::ffff:192.168.1.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  // Normalize IPv6 loopback
  if (ip === '::1') {
    ip = '127.0.0.1';
  }
  return ip || '127.0.0.1';
}

/**
 * Returns a one-way SHA-256 hash prefix of an IP address.
 * @param {string} ip
 * @returns {string}
 */
export function hashIp(ip) {
  return createHash('sha256')
    .update(`zlog:${ip ?? 'unknown'}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Parses User-Agent to extract device type, OS, and browser.
 * No external dependencies required.
 * @param {string} [ua='']
 * @returns {{ deviceType: 'desktop'|'mobile'|'tablet'|'bot', os: string, browser: string }}
 */
export function parseSystem(ua = '') {
  const s = String(ua ?? '').trim();
  const lower = s.toLowerCase();

  // Detect bots / automated crawlers
  if (/bot|crawler|spider|crawling|slurp|duckduckbot|facebookexternalhit|bingbot|googlebot/i.test(s)) {
    return {deviceType: 'bot', os: 'Bot/Crawler', browser: 'Bot'};
  }

  // OS detection
  let os = 'Other OS';
  if (/windows nt 10\.0/i.test(s)) {
    os = 'Windows';
  } else if (/windows nt/i.test(s)) {
    os = 'Windows';
  } else if (/iphone|ipad|ipod/i.test(s)) {
    os = 'iOS';
  } else if (/android/i.test(s)) {
    os = 'Android';
  } else if (/macintosh|mac os x/i.test(s)) {
    os = 'macOS';
  } else if (/cros/i.test(s)) {
    os = 'Chrome OS';
  } else if (/linux|x11/i.test(s)) {
    os = 'Linux';
  }

  // Browser detection (order matters due to UA token overlap)
  let browser = 'Other Browser';
  if (/edg\//i.test(s)) {
    browser = 'Edge';
  } else if (/opr\/|opera/i.test(s)) {
    browser = 'Opera';
  } else if (/chrome|crios/i.test(s) && !/edg\//i.test(s)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(s)) {
    browser = 'Firefox';
  } else if (/safari/i.test(s) && !/chrome|crios/i.test(s)) {
    browser = 'Safari';
  }

  // Device type
  let deviceType = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))|kindle|playbook|silk/i.test(lower)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|windows phone|opera mini/i.test(lower)) {
    deviceType = 'mobile';
  }

  return {deviceType, os, browser};
}

// ---------------------------------------------------------------------------
// Write — Records view and detects returning visitor & repeat page view
// ---------------------------------------------------------------------------

/**
 * Records a page view with complete node, system, and returning status.
 *
 * @param {object} opts
 * @param {string} opts.path
 * @param {string} opts.visitorId
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.userAgent]
 * @returns {{ id: number, path: string, visitorId: string, ipAddress: string, deviceType: string, os: string, browser: string, isReturning: number, isPageRepeat: number, visitNumber: number }}
 */
export function recordPageView({path, visitorId, ipAddress, userAgent}) {
  const ip = normalizeIp(ipAddress);
  const ipH = hashIp(ip);
  const {deviceType, os, browser} = parseSystem(userAgent);

  // Check if this visitor/node has visited ANY page before on this site
  const prevSiteVisit = db.prepare(`
    SELECT COUNT(*) AS total_views
    FROM page_views
    WHERE visitor_id = ?
       OR (ip_address = ? AND ip_address NOT IN ('127.0.0.1', 'localhost', '::1') AND ip_address IS NOT NULL)
  `).get(visitorId, ip);

  const prevSiteCount = prevSiteVisit?.total_views ?? 0;
  const isReturning = prevSiteCount > 0 ? 1 : 0;
  const visitNumber = prevSiteCount + 1;

  // Check if this visitor/node has visited THIS SPECIFIC page before
  const prevPageVisit = db.prepare(`
    SELECT COUNT(*) AS path_views
    FROM page_views
    WHERE path = ?
      AND (visitor_id = ?
       OR (ip_address = ? AND ip_address NOT IN ('127.0.0.1', 'localhost', '::1') AND ip_address IS NOT NULL))
  `).get(path, visitorId, ip);

  const isPageRepeat = (prevPageVisit?.path_views ?? 0) > 0 ? 1 : 0;

  const result = db.prepare(`
    INSERT INTO page_views (
      path, visitor_id, ip_address, ip_hash,
      device_type, os, browser, user_agent,
      is_returning, is_page_repeat, visit_number
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    path,
    visitorId,
    ip,
    ipH,
    deviceType,
    os,
    browser,
    userAgent ? String(userAgent).slice(0, 512) : null,
    isReturning,
    isPageRepeat,
    visitNumber
  );

  return {
    id: Number(result.lastInsertRowid),
    path,
    visitorId,
    ipAddress: ip,
    deviceType,
    os,
    browser,
    isReturning,
    isPageRepeat,
    visitNumber,
  };
}

// ---------------------------------------------------------------------------
// Read — Analytics & Identified Node/Visitor Queries
// ---------------------------------------------------------------------------

/** Total raw page views. */
export function getTotalPageViews() {
  return db.prepare('SELECT COUNT(*) AS count FROM page_views').get().count;
}

/** Total distinct visitor UUIDs. */
export function getTotalUniqueVisitors() {
  return db.prepare('SELECT COUNT(DISTINCT visitor_id) AS count FROM page_views WHERE visitor_id IS NOT NULL').get().count;
}

/** Unique visitors who have visited more than once. */
export function getReturningVisitorCount() {
  return db.prepare(`
    SELECT COUNT(*) AS count FROM (
      SELECT visitor_id
      FROM page_views
      WHERE visitor_id IS NOT NULL
      GROUP BY visitor_id
      HAVING COUNT(*) > 1
    )
  `).get().count;
}

/** Total views that represent a return visit (visit_number > 1). */
export function getRepeatViewsCount() {
  return db.prepare('SELECT COUNT(*) AS count FROM page_views WHERE is_returning = 1').get().count;
}

/** Device type breakdown: { desktop, mobile, tablet, bot } */
export function getDeviceBreakdown() {
  const rows = db.prepare(`
    SELECT device_type, COUNT(*) AS views
    FROM page_views
    WHERE device_type IS NOT NULL
    GROUP BY device_type
  `).all();
  const result = {desktop: 0, mobile: 0, tablet: 0, bot: 0};
  for (const row of rows) {
    if (row.device_type in result) {
      result[row.device_type] = row.views;
    }
  }
  return result;
}

/** Operating system breakdown. */
export function getOsBreakdown(limit = 6) {
  return db.prepare(`
    SELECT os, COUNT(*) AS views
    FROM page_views
    WHERE os IS NOT NULL
    GROUP BY os
    ORDER BY views DESC
    LIMIT ?
  `).all(limit);
}

/** Browser breakdown. */
export function getBrowserBreakdown(limit = 6) {
  return db.prepare(`
    SELECT browser, COUNT(*) AS views
    FROM page_views
    WHERE browser IS NOT NULL
    GROUP BY browser
    ORDER BY views DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Top N paths by view count, plus unique visitors and repeat visits to each path.
 * @param {number} [limit=10]
 */
export function getTopPaths(limit = 10) {
  return db.prepare(`
    SELECT
      path,
      COUNT(*) AS views,
      COUNT(DISTINCT visitor_id) AS unique_visitors,
      SUM(CASE WHEN is_page_repeat = 1 THEN 1 ELSE 0 END) AS repeat_views
    FROM page_views
    GROUP BY path
    ORDER BY views DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Per-post view counts including unique visitors, returning visitors, and repeat views.
 * @returns {Array<{ slug: string, views: number, unique_visitors: number, repeat_views: number, returning_visitors: number }>}
 */
export function getPostViewCounts() {
  return db.prepare(`
    SELECT
      p.slug,
      COUNT(pv.id) AS views,
      COUNT(DISTINCT pv.visitor_id) AS unique_visitors,
      SUM(CASE WHEN pv.is_page_repeat = 1 THEN 1 ELSE 0 END) AS repeat_views,
      COUNT(DISTINCT CASE WHEN pv.is_page_repeat = 1 THEN pv.visitor_id ELSE NULL END) AS returning_visitors
    FROM posts p
    LEFT JOIN page_views pv ON pv.path = '/posts/' || p.slug
    WHERE p.status = 'published'
    GROUP BY p.id
  `).all();
}

/**
 * Identified visitors list (aggregating by visitor_id / node) so the owner can
 * identify returning nodes, IPs, systems, and pages visited.
 *
 * @param {number} [limit=50]
 * @returns {Array<{
 *   visitor_id: string,
 *   ip_address: string,
 *   device_type: string,
 *   os: string,
 *   browser: string,
 *   total_visits: number,
 *   is_returning: number,
 *   unique_pages: number,
 *   first_seen: string,
 *   last_seen: string
 * }>}
 */
export function getVisitorsSummary(limit = 50) {
  return db.prepare(`
    SELECT
      visitor_id,
      COALESCE(MAX(ip_address), 'unknown') AS ip_address,
      MAX(device_type) AS device_type,
      COALESCE(MAX(os), 'Unknown OS') AS os,
      COALESCE(MAX(browser), 'Unknown Browser') AS browser,
      COUNT(*) AS total_visits,
      CASE WHEN COUNT(*) > 1 THEN 1 ELSE 0 END AS is_returning,
      COUNT(DISTINCT path) AS unique_pages,
      MIN(viewed_at) AS first_seen,
      MAX(viewed_at) AS last_seen
    FROM page_views
    WHERE visitor_id IS NOT NULL
    GROUP BY visitor_id
    ORDER BY total_visits DESC, last_seen DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Most recent page views stream with visitor identification and returning status.
 *
 * @param {number} [limit=25]
 * @returns {Array<{
 *   id: number,
 *   path: string,
 *   visitor_id: string,
 *   ip_address: string,
 *   device_type: string,
 *   os: string,
 *   browser: string,
 *   is_returning: number,
 *   is_page_repeat: number,
 *   visit_number: number,
 *   viewed_at: string
 * }>}
 */
export function getRecentVisitorActivity(limit = 25) {
  return db.prepare(`
    SELECT
      id,
      path,
      visitor_id,
      COALESCE(ip_address, 'unknown') AS ip_address,
      device_type,
      COALESCE(os, 'Unknown OS') AS os,
      COALESCE(browser, 'Unknown') AS browser,
      is_returning,
      is_page_repeat,
      visit_number,
      viewed_at
    FROM page_views
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Returns the page-view count for a specific path.
 * @param {string} path
 */
export function getPageViewsForPath(path) {
  return db.prepare('SELECT COUNT(*) AS count FROM page_views WHERE path = ?').get(path).count;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function readCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
