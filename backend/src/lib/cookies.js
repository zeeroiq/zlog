export function readCookie(header = '', name) {
  const prefix = `${name}=`;
  return header.split(';').map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length);
}

export function sessionCookieOptions(expiresAt) {
  return {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(expiresAt), path: '/'};
}
