import {db} from '../../database.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Subscribes an email address to the newsletter.
 * Throws if the email is invalid or already subscribed.
 * @param {string} rawEmail
 * @returns {{ id: number, email: string, subscribed_at: string }}
 */
export function subscribe(rawEmail) {
  const email = String(rawEmail ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  try {
    const result = db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email);
    return db.prepare('SELECT id, email, subscribed_at FROM subscribers WHERE id = ?').get(result.lastInsertRowid);
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      throw new Error('This email address is already subscribed.');
    }
    throw error;
  }
}

/**
 * Unsubscribes (deletes) an email address.
 * @param {string} email
 * @returns {boolean} true if a row was deleted
 */
export function unsubscribe(email) {
  return db.prepare('DELETE FROM subscribers WHERE email = ?').run(String(email).trim().toLowerCase()).changes > 0;
}

/**
 * Returns the total subscriber count.
 * @returns {number}
 */
export function getSubscriberCount() {
  return db.prepare('SELECT COUNT(*) AS count FROM subscribers').get().count;
}

/**
 * Lists all subscribers, newest first.
 * @returns {Array<{id: number, email: string, subscribed_at: string}>}
 */
export function listSubscribers() {
  return db.prepare('SELECT id, email, subscribed_at FROM subscribers ORDER BY subscribed_at DESC').all();
}

/**
 * Deletes a subscriber by id. Owner-only operation.
 * @param {number|string} id
 * @returns {boolean}
 */
export function deleteSubscriber(id) {
  return db.prepare('DELETE FROM subscribers WHERE id = ?').run(id).changes > 0;
}
