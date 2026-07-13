#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createServer } from './server.js';
import { SerperClient } from './serper-client.js';

async function main(): Promise<void> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('SERPER_API_KEY is required.');
  }

  const server = createServer(new SerperClient({ apiKey }));
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error.';
  // stdout belongs exclusively to the MCP stdio transport.
  console.error(`serper-dev-mcp: ${message}`);
  process.exitCode = 1;
});
