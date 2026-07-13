import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';

import { SerperApiError, type SerperClient, type SerperEndpoint } from './serper-client.js';
import { toolInputSchemas, toolResponseSchemas } from './schemas.js';

export interface SerperToolDefinition {
  name: `serper_${SerperEndpoint}`;
  title: string;
  description: string;
  endpoint: SerperEndpoint;
  inputSchema: z.ZodType<Record<string, unknown>>;
  responseSchema: z.ZodType<Record<string, unknown>>;
}

export const TOOL_DEFINITIONS: readonly SerperToolDefinition[] = [
  { name: 'serper_search', title: 'Serper Web Search', description: 'Search Google web results through Serper.dev.', endpoint: 'search', inputSchema: toolInputSchemas.search, responseSchema: toolResponseSchemas.search },
  { name: 'serper_images', title: 'Serper Image Search', description: 'Search Google Images through Serper.dev.', endpoint: 'images', inputSchema: toolInputSchemas.images, responseSchema: toolResponseSchemas.images },
  { name: 'serper_videos', title: 'Serper Video Search', description: 'Search Google video results through Serper.dev.', endpoint: 'videos', inputSchema: toolInputSchemas.videos, responseSchema: toolResponseSchemas.videos },
  { name: 'serper_places', title: 'Serper Places Search', description: 'Search Google local places through Serper.dev.', endpoint: 'places', inputSchema: toolInputSchemas.places, responseSchema: toolResponseSchemas.places },
  { name: 'serper_maps', title: 'Serper Maps Search', description: 'Retrieve Google Maps place results through Serper.dev.', endpoint: 'maps', inputSchema: toolInputSchemas.maps, responseSchema: toolResponseSchemas.maps },
  { name: 'serper_reviews', title: 'Serper Reviews', description: 'Retrieve Google place reviews through Serper.dev.', endpoint: 'reviews', inputSchema: toolInputSchemas.reviews, responseSchema: toolResponseSchemas.reviews },
  { name: 'serper_news', title: 'Serper News Search', description: 'Search Google News through Serper.dev.', endpoint: 'news', inputSchema: toolInputSchemas.news, responseSchema: toolResponseSchemas.news },
  { name: 'serper_shopping', title: 'Serper Shopping Search', description: 'Search Google Shopping through Serper.dev.', endpoint: 'shopping', inputSchema: toolInputSchemas.shopping, responseSchema: toolResponseSchemas.shopping },
  { name: 'serper_lens', title: 'Serper Google Lens', description: 'Analyze a public image URL with Google Lens through Serper.dev.', endpoint: 'lens', inputSchema: toolInputSchemas.lens, responseSchema: toolResponseSchemas.lens },
  { name: 'serper_patents', title: 'Serper Patent Search', description: 'Search Google Patents through Serper.dev.', endpoint: 'patents', inputSchema: toolInputSchemas.patents, responseSchema: toolResponseSchemas.patents },
  { name: 'serper_autocomplete', title: 'Serper Autocomplete', description: 'Retrieve Google autocomplete suggestions through Serper.dev.', endpoint: 'autocomplete', inputSchema: toolInputSchemas.autocomplete, responseSchema: toolResponseSchemas.autocomplete },
  { name: 'serper_scrape', title: 'Serper Web Scrape', description: 'Scrape a public HTTP or HTTPS page through Serper.dev.', endpoint: 'scrape', inputSchema: toolInputSchemas.scrape, responseSchema: toolResponseSchemas.scrape },
];

export function registerSerperTools(
  server: McpServer,
  client: Pick<SerperClient, 'request'>,
): void {
  for (const definition of TOOL_DEFINITIONS) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: definition.responseSchema,
      },
      async (args) => {
        try {
          const response = await client.request(
            definition.endpoint,
            args as Record<string, unknown>,
          );
          // Response parsing models common fields while catchall schemas keep
          // endpoint additions intact for forward compatibility.
          const result = definition.responseSchema.parse(response);
          return {
            structuredContent: result,
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (error: unknown) {
          const message = error instanceof SerperApiError
            ? error.message
            : 'Serper request failed unexpectedly.';
          return {
            isError: true,
            content: [{ type: 'text' as const, text: message }],
          };
        }
      },
    );
  }
}
