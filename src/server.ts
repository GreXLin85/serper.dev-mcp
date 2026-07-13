import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { SerperClient } from './serper-client.js';
import { registerSerperTools } from './tools.js';

export function createServer(client: Pick<SerperClient, 'request'>): McpServer {
  const server = new McpServer({
    name: 'serper-dev-mcp',
    version: '0.1.0',
  });

  registerSerperTools(server, client);
  return server;
}
