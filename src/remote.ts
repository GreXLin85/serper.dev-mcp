#!/usr/bin/env node
import { spawn } from 'node:child_process';

import { createRemoteProxy } from './remote-proxy.js';

const host = process.env.MCP_SERVER_HOST?.trim() || '0.0.0.0';
const port = Number(process.env.MCP_SERVER_PORT ?? '8000');
const upstreamPort = Number(process.env.MCP_UPSTREAM_PORT ?? '8001');
const username = process.env.MCP_BASIC_USERNAME?.trim() || 'mcp';
const password = process.env.MCP_BASIC_PASSWORD?.trim();

if (!password) {
  throw new Error('MCP_BASIC_PASSWORD is required.');
}
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('MCP_SERVER_PORT must be a valid TCP port.');
}
if (!Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65_535) {
  throw new Error('MCP_UPSTREAM_PORT must be a valid TCP port.');
}

const gateway = spawn('supergateway', [
  '--stdio',
  'node /app/dist/index.js',
  '--outputTransport',
  'streamableHttp',
  '--port',
  String(upstreamPort),
  '--streamableHttpPath',
  '/mcp',
  '--healthEndpoint',
  '/healthz',
  '--logLevel',
  'info',
], {
  env: process.env,
  stdio: 'inherit',
});

const proxy = createRemoteProxy({
  upstreamHost: '127.0.0.1',
  upstreamPort,
  username,
  password,
});

proxy.listen(port, host, () => {
  console.error(`serper-dev-mcp: remote endpoint listening on ${host}:${port}`);
});

gateway.once('exit', (code, signal) => {
  console.error(
    `serper-dev-mcp: Supergateway exited (${signal ?? code ?? 'unknown'}).`,
  );
  proxy.close(() => {
    process.exitCode = code && code > 0 ? code : 1;
  });
});

function shutdown(signal: NodeJS.Signals): void {
  gateway.kill(signal);
  proxy.close();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
