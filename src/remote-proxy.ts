import {
  createServer,
  request as createUpstreamRequest,
  type Server,
} from 'node:http';

import { hasValidBasicAuth } from './remote-auth.js';

export interface RemoteProxyOptions {
  upstreamHost: string;
  upstreamPort: number;
  username: string;
  password: string;
}

export function createRemoteProxy(options: RemoteProxyOptions): Server {
  return createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('ok');
      return;
    }

    if (!hasValidBasicAuth(
      request.headers.authorization,
      options.username,
      options.password,
    )) {
      response.writeHead(401, {
        'Content-Type': 'text/plain; charset=utf-8',
        'WWW-Authenticate': 'Basic realm="MCP"',
      });
      response.end('Unauthorized');
      return;
    }

    const headers = { ...request.headers };
    delete headers.host;

    const upstream = createUpstreamRequest({
      host: options.upstreamHost,
      port: options.upstreamPort,
      path: request.url,
      method: request.method,
      headers,
    }, (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    });

    upstream.on('error', () => {
      if (!response.headersSent) {
        response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      response.end('Bad Gateway');
    });

    request.pipe(upstream);
  });
}
