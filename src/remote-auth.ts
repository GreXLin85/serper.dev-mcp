import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

export function hasValidBasicAuth(
  authorization: string | undefined,
  username: string,
  password: string,
): boolean {
  if (!authorization?.startsWith('Basic ')) {
    return false;
  }

  const encoded = authorization.slice('Basic '.length).trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    return false;
  }

  const received = Buffer.from(encoded, 'base64');
  const expected = Buffer.from(`${username}:${password}`);

  return received.length === expected.length && timingSafeEqual(received, expected);
}
