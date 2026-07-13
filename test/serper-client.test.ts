import { afterEach, describe, expect, it, vi } from 'vitest';

import { SerperApiError, SerperClient } from '../src/serper-client.js';

describe('SerperClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts JSON with Serper authentication to the Google host', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ credits: 1 }), { status: 200 }),
    );

    await new SerperClient({ apiKey: 'test-key', fetch }).request('search', {
      q: 'apple',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://google.serper.dev/search',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'test-key',
        },
        body: JSON.stringify({ q: 'apple' }),
      }),
    );
  });

  it('routes scrape to the scrape host', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ text: 'Example' }), { status: 200 }),
    );

    await new SerperClient({ apiKey: 'test-key', fetch }).request('scrape', {
      url: 'https://example.com',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://scrape.serper.dev/',
      expect.any(Object),
    );
  });

  it('reports non-2xx responses without exposing the API key', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response('rate limited: test-key', { status: 429 }),
    );
    const request = new SerperClient({ apiKey: 'test-key', fetch }).request(
      'search',
      { q: 'apple' },
    );

    await expect(request).rejects.toMatchObject({ code: 'http', status: 429 });
    await expect(request).rejects.not.toThrow('test-key');
  });

  it('distinguishes invalid JSON and non-object responses', async () => {
    const responses = ['not-json', '[]'];

    for (const body of responses) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(body, { status: 200 }),
      );

      await expect(
        new SerperClient({ apiKey: 'test-key', fetch }).request('search', {
          q: 'apple',
        }),
      ).rejects.toMatchObject({ code: 'invalid_response' });
    }
  });

  it('maps aborted requests to a timeout error', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      }),
    );
    const request = new SerperClient({
      apiKey: 'test-key',
      fetch,
      timeoutMs: 1_000,
    }).request('search', { q: 'apple' });
    const rejection = expect(request).rejects.toMatchObject({ code: 'timeout' });

    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
  });

  it('maps network errors without copying their potentially sensitive text', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(
      new Error('failed while using test-key'),
    );

    await expect(
      new SerperClient({ apiKey: 'test-key', fetch }).request('news', {
        q: 'apple',
      }),
    ).rejects.toEqual(
      new SerperApiError('Unable to reach Serper.', 'network'),
    );
  });

  it('requires a non-empty API key', () => {
    expect(() => new SerperClient({ apiKey: '   ' })).toThrow(
      'SERPER_API_KEY is required.',
    );
  });
});
