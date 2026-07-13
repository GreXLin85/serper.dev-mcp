export type SerperEndpoint =
  | 'search'
  | 'images'
  | 'videos'
  | 'places'
  | 'maps'
  | 'reviews'
  | 'news'
  | 'shopping'
  | 'lens'
  | 'patents'
  | 'autocomplete'
  | 'scrape';

export interface SerperClientOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

type SerperErrorCode = 'http' | 'network' | 'timeout' | 'invalid_response';

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_UPSTREAM_ERROR_LENGTH = 500;

export class SerperApiError extends Error {
  constructor(
    message: string,
    readonly code: SerperErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SerperApiError';
  }
}

export class SerperClient {
  private readonly apiKey: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  constructor(options: SerperClientOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new Error('SERPER_API_KEY is required.');
    }

    this.apiKey = apiKey;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.timeoutMs = Math.min(
      MAX_TIMEOUT_MS,
      Math.max(MIN_TIMEOUT_MS, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    );
  }

  async request(
    endpoint: SerperEndpoint,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = endpoint === 'scrape'
      ? 'https://scrape.serper.dev/'
      : `https://google.serper.dev/${endpoint}`;

    try {
      const response = await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        const detail = this.sanitizeUpstreamText(responseText);
        const suffix = detail ? `: ${detail}` : '.';
        throw new SerperApiError(
          `Serper request failed with HTTP ${response.status}${suffix}`,
          'http',
          response.status,
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        throw new SerperApiError(
          'Serper returned an invalid JSON response.',
          'invalid_response',
        );
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new SerperApiError(
          'Serper returned an invalid response object.',
          'invalid_response',
        );
      }

      return parsed as Record<string, unknown>;
    } catch (error: unknown) {
      if (error instanceof SerperApiError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new SerperApiError('Serper request timed out.', 'timeout');
      }
      throw new SerperApiError('Unable to reach Serper.', 'network');
    } finally {
      clearTimeout(timeout);
    }
  }

  private sanitizeUpstreamText(text: string): string {
    // Upstream text is bounded and any reflected credential is removed before
    // it can cross the MCP boundary.
    return text
      .replaceAll(this.apiKey, '[redacted]')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .slice(0, MAX_UPSTREAM_ERROR_LENGTH);
  }
}
