import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

describe('remote MCP basic authentication', () => {
  it('accepts the configured username and password', async () => {
    const modulePath = '../src/remote-auth.js';
    const authModule = await import(modulePath).catch(() => undefined);
    const credentials = Buffer.from('mcp:secret').toString('base64');

    expect(
      authModule?.hasValidBasicAuth?.(`Basic ${credentials}`, 'mcp', 'secret'),
    ).toBe(true);
  });

  it('rejects malformed headers and incorrect credentials', async () => {
    const { hasValidBasicAuth } = await import('../src/remote-auth.js');
    const wrongCredentials = Buffer.from('mcp:wrong').toString('base64');

    expect(hasValidBasicAuth(undefined, 'mcp', 'secret')).toBe(false);
    expect(hasValidBasicAuth('Bearer token', 'mcp', 'secret')).toBe(false);
    expect(hasValidBasicAuth('Basic not-base64!', 'mcp', 'secret')).toBe(false);
    expect(
      hasValidBasicAuth(`Basic ${wrongCredentials}`, 'mcp', 'secret'),
    ).toBe(false);
  });
});
