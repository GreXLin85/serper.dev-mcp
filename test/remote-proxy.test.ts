import { Buffer } from 'node:buffer';
import { createServer as createHttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, expect, it } from 'vitest';

import { createRemoteProxy } from '../src/remote-proxy.js';

async function listen(server: ReturnType<typeof createHttpServer>): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

async function close(server: ReturnType<typeof createHttpServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe('remote MCP proxy', () => {
  it('provides a proxy server factory', async () => {
    const modulePath = '../src/remote-proxy.js';
    const proxyModule = await import(modulePath).catch(() => undefined);

    expect(proxyModule?.createRemoteProxy).toBeTypeOf('function');
  });

  it('keeps health public and protects proxied MCP traffic', async () => {
    const upstream = createHttpServer((_request, response) => {
      response.end('proxied');
    });
    const upstreamPort = await listen(upstream);
    const proxy = createRemoteProxy({
      upstreamHost: '127.0.0.1',
      upstreamPort,
      username: 'mcp',
      password: 'secret',
    });
    const proxyPort = await listen(proxy);
    const baseUrl = `http://127.0.0.1:${proxyPort}`;
    const credentials = Buffer.from('mcp:secret').toString('base64');

    try {
      const healthStatus = await fetch(`${baseUrl}/healthz`, {
        signal: AbortSignal.timeout(500),
      }).then((response) => response.status).catch(() => 0);
      expect(healthStatus).toBe(200);

      const anonymous = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        signal: AbortSignal.timeout(500),
      });
      expect(anonymous.status).toBe(401);

      const authenticated = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}` },
        signal: AbortSignal.timeout(500),
      });
      expect(authenticated.status).toBe(200);
      expect(await authenticated.text()).toBe('proxied');
    } finally {
      await close(proxy);
      await close(upstream);
    }
  });
});
