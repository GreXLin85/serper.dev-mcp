import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../src/server.js';
import { SerperApiError, type SerperClient } from '../src/serper-client.js';

const expectedTools = [
  'serper_search',
  'serper_images',
  'serper_videos',
  'serper_places',
  'serper_maps',
  'serper_reviews',
  'serper_news',
  'serper_shopping',
  'serper_lens',
  'serper_patents',
  'serper_autocomplete',
  'serper_scrape',
];

describe('Serper MCP tools', () => {
  const request = vi.fn<SerperClient['request']>();
  let client: Client;

  beforeEach(async () => {
    request.mockReset();
    const server = createServer({ request });
    client = new Client({ name: 'test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
  });

  it('exposes exactly the twelve supported tools', async () => {
    const result = await client.listTools();
    expect(result.tools.map((tool) => tool.name).sort()).toEqual(
      [...expectedTools].sort(),
    );
    expect(result.tools.some((tool) => tool.name.includes('scholar'))).toBe(false);
  });

  it.each([
    ['serper_search', 'search', { q: 'apple' }],
    ['serper_images', 'images', { q: 'apple' }],
    ['serper_videos', 'videos', { q: 'apple' }],
    ['serper_places', 'places', { q: 'coffee' }],
    ['serper_maps', 'maps', { q: 'Apple Store' }],
    ['serper_reviews', 'reviews', { cid: '123' }],
    ['serper_news', 'news', { q: 'apple' }],
    ['serper_shopping', 'shopping', { q: 'iphone' }],
    ['serper_lens', 'lens', { url: 'https://example.com/image.jpg' }],
    ['serper_patents', 'patents', { q: 'touchscreen' }],
    ['serper_autocomplete', 'autocomplete', { q: 'apple' }],
    ['serper_scrape', 'scrape', { url: 'https://example.com', includeMarkdown: true }],
  ])('routes %s to %s', async (tool, endpoint, args) => {
    request.mockResolvedValueOnce({ credits: 1 });

    await client.callTool({ name: tool, arguments: args });

    expect(request).toHaveBeenLastCalledWith(endpoint, args);
  });

  it('returns the complete object as structured content and JSON text', async () => {
    const upstream = {
      searchParameters: { q: 'apple' },
      organic: [{ title: 'Apple', futureField: 42 }],
      futureCollection: [{ value: true }],
      credits: 1,
    };
    request.mockResolvedValueOnce(upstream);

    const result = await client.callTool({
      name: 'serper_search',
      arguments: { q: 'apple' },
    });

    expect(result.structuredContent).toEqual(upstream);
    const firstContent = result.content[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type === 'text') {
      expect(JSON.parse(firstContent.text)).toEqual(upstream);
    }
  });

  it('rejects a missing search query before calling Serper', async () => {
    await expect(
      client.callTool({ name: 'serper_search', arguments: {} }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it.each(['serper_lens', 'serper_scrape'])(
    'rejects non-http URLs for %s',
    async (name) => {
      await expect(
        client.callTool({ name, arguments: { url: 'file:///etc/passwd' } }),
      ).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['serper_maps', {}],
    ['serper_reviews', {}],
  ])('enforces specialized identifier requirements for %s', async (name, args) => {
    await expect(client.callTool({ name, arguments: args })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it('returns sanitized upstream failures as MCP tool errors', async () => {
    request.mockRejectedValueOnce(
      new SerperApiError('Serper request failed with HTTP 429.', 'http', 429),
    );

    const result = await client.callTool({
      name: 'serper_search',
      arguments: { q: 'apple' },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'Serper request failed with HTTP 429.' },
    ]);
  });

  it('hides unexpected error details', async () => {
    request.mockRejectedValueOnce(new Error('sensitive implementation detail'));

    const result = await client.callTool({
      name: 'serper_search',
      arguments: { q: 'apple' },
    });

    expect(result).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Serper request failed unexpectedly.' }],
    });
  });
});
